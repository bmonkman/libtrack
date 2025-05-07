import type {
	Book,
	BookState,
	LibraryCard,
	User,
	PasskeyRegistrationRequest,
	PasskeyLoginRequest
} from './types';

// Use the Vercel deployment URL in production, or local API in development
const API_BASE_URL =
	import.meta.env.PUBLIC_API_BASE_URL ||
	(import.meta.env.DEV ? 'http://localhost:3000/api' : 'https://libtrack-api.vercel.app/api');

// Define interfaces for WebAuthn types
interface WebAuthnRegistrationOptions {
	challenge: ArrayBuffer;
	rp: {
		name: string;
		id: string;
	};
	user: {
		id: ArrayBuffer;
		name: string;
		displayName: string;
	};
	pubKeyCredParams: Array<{ type: string; alg: number }>;
	timeout?: number;
	attestation?: string;
	authenticatorSelection?: {
		authenticatorAttachment?: string;
		requireResidentKey?: boolean;
		userVerification?: string;
	};
	excludeCredentials?: Array<{
		id: ArrayBuffer;
		type: string;
		transports?: string[];
	}>;
}

interface WebAuthnLoginOptions {
	challenge: ArrayBuffer;
	timeout?: number;
	rpId?: string;
	allowCredentials?: Array<{
		id: ArrayBuffer;
		type: string;
		transports?: string[];
	}>;
	userVerification?: string;
}

interface AuthResponse {
	user: User;
	token: string;
}

// Store authentication token
let authToken: string | null = null;

// Function to get token from localStorage that can be called anytime
export const getStoredAuthToken = (): string | null => {
	if (typeof window !== 'undefined') {
		return localStorage.getItem('auth_token');
	}
	return null;
};

// Load token from localStorage on initialization
if (typeof window !== 'undefined') {
	authToken = getStoredAuthToken();
}

// Set authentication token
export const setAuthToken = (token: string | null): void => {
	authToken = token;
	if (typeof window !== 'undefined') {
		if (token) {
			localStorage.setItem('auth_token', token);
		} else {
			localStorage.removeItem('auth_token');
		}
	}
};

// Function to ensure we always have the latest token
const getAuthToken = (): string | null => {
	if (!authToken && typeof window !== 'undefined') {
		authToken = getStoredAuthToken();
	}
	return authToken;
};

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
	// Add authentication header if token exists
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'X-Requested-With': 'XMLHttpRequest',
		...((options.headers as Record<string, string>) || {})
	};

	const token = getAuthToken();
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	const response = await fetch(`${API_BASE_URL}${endpoint}`, {
		...options,
		headers,
		credentials: 'include'
	});

	if (!response.ok) {
		// Handle 401 Unauthorized by clearing token
		if (response.status === 401) {
			setAuthToken(null);
		}
		throw new Error(`API error: ${response.statusText}`);
	}

	return response.json();
}

// Convert base64 string to ArrayBuffer
function base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
	const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
	const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	const buffer = new Uint8Array(rawData.length);

	for (let i = 0; i < rawData.length; i++) {
		buffer[i] = rawData.charCodeAt(i);
	}
	return buffer.buffer;
}

// Auth API
export const authApi = {
	getRegistrationOptions: async (username: string): Promise<WebAuthnRegistrationOptions> => {
		const response = await fetchApi<Partial<WebAuthnRegistrationOptions>>(
			'/auth/registration-options',
			{
				method: 'POST',
				body: JSON.stringify({ username })
			}
		);

		// Convert base64 strings from the server to ArrayBuffers required by the WebAuthn API
		if (typeof response.challenge === 'string') {
			response.challenge = base64UrlToArrayBuffer(response.challenge);
		}

		// Ensure user.id is properly converted to ArrayBuffer
		if (response.user && response.user.id && typeof response.user.id === 'string') {
			response.user.id = base64UrlToArrayBuffer(response.user.id);
		}

		if (response.excludeCredentials) {
			response.excludeCredentials = response.excludeCredentials.map((cred) => ({
				...cred,
				id: typeof cred.id === 'string' ? base64UrlToArrayBuffer(cred.id) : cred.id
			}));
		}

		return response as WebAuthnRegistrationOptions;
	},

	register: async (data: PasskeyRegistrationRequest): Promise<User> => {
		const response = await fetchApi<AuthResponse>('/auth/register', {
			method: 'POST',
			body: JSON.stringify(data)
		});
		setAuthToken(response.token);
		return response.user;
	},

	getLoginOptions: async (): Promise<WebAuthnLoginOptions> => {
		const response = await fetchApi<Partial<WebAuthnLoginOptions>>('/auth/login-options', {
			method: 'POST'
		});

		// Convert base64 strings from the server to ArrayBuffers required by the WebAuthn API
		if (typeof response.challenge === 'string') {
			response.challenge = base64UrlToArrayBuffer(response.challenge);
		}

		if (response.allowCredentials) {
			response.allowCredentials = response.allowCredentials.map((cred) => ({
				...cred,
				id: typeof cred.id === 'string' ? base64UrlToArrayBuffer(cred.id) : cred.id
			}));
		}

		return response as WebAuthnLoginOptions;
	},

	login: async (data: PasskeyLoginRequest): Promise<User> => {
		const response = await fetchApi<AuthResponse>('/auth/login', {
			method: 'POST',
			body: JSON.stringify(data)
		});
		setAuthToken(response.token);
		return response.user;
	},

	verify: async (credentialId: string): Promise<User> => {
		const response = await fetchApi<AuthResponse>('/auth/verify', {
			method: 'POST',
			body: JSON.stringify({ credentialId })
		});
		setAuthToken(response.token);
		return response.user;
	},

	getCurrentUser: () => fetchApi<{ user: User }>('/auth/me').then((res) => res.user),

	logout: () => {
		setAuthToken(null);
		return Promise.resolve();
	},

	isAuthenticated: () => !!authToken
};

// Books API
export const booksApi = {
	getBooks: (states?: BookState[]) =>
		fetchApi<Book[]>(`/books${states ? `?states=${states.join(',')}` : ''}`),

	updateStates: (
		updates: Array<{ id: string; isbn: string; state: BookState; dueDate?: string }>
	) =>
		fetchApi<Book[]>('/books/states', {
			method: 'PUT',
			body: JSON.stringify({ updates })
		})
};

// Library Cards API
export const libraryCardsApi = {
	getLibraryCards: () => fetchApi<LibraryCard[]>('/library-cards'),

	addLibraryCard: (libraryCard: Omit<LibraryCard, 'id'>) =>
		fetchApi<LibraryCard>('/library-cards', {
			method: 'POST',
			body: JSON.stringify(libraryCard)
		}),

	updateLibraryCard: (libraryCard: Partial<LibraryCard> & { id: string }) =>
		fetchApi<LibraryCard>(`/library-cards/${libraryCard.id}`, {
			method: 'PUT',
			body: JSON.stringify(libraryCard)
		}),

	deleteLibraryCard: (id: string) =>
		fetchApi<void>(`/library-cards/${id}`, {
			method: 'DELETE'
		}),

	syncBooks: (libraryCardId: string) =>
		fetchApi<Book[]>(`/library-cards/${libraryCardId}/sync-books`, {
			method: 'POST'
		})
};
