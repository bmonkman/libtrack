import { PUBLIC_API_BASE_URL } from '$env/static/public';
import type {
	AuthenticationResponseJSON,
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
	RegistrationResponseJSON
} from '@simplewebauthn/browser';
import type { Book, BookState, LibraryCard, Passkey, PhotoMatches, User } from './types';

// Set per environment in Vercel and in .env.local for local dev
const API_BASE_URL = PUBLIC_API_BASE_URL;

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
		const body = await response.json().catch(() => null);
		throw new Error(body?.error ?? `API error: ${response.statusText}`);
	}

	if (response.status === 204) {
		return undefined as T;
	}
	return response.json();
}

// Auth API. Each passkey flow is two calls: fetch options, let the browser create or use the
// passkey, then send the browser's response back for the server to verify.
export const authApi = {
	getRegistrationOptions: (username: string) =>
		fetchApi<PublicKeyCredentialCreationOptionsJSON>('/auth/registration-options', {
			method: 'POST',
			body: JSON.stringify({ username })
		}),

	register: async (response: RegistrationResponseJSON): Promise<User> => {
		const result = await fetchApi<AuthResponse>('/auth/register', {
			method: 'POST',
			body: JSON.stringify({ response })
		});
		setAuthToken(result.token);
		return result.user;
	},

	getLoginOptions: () =>
		fetchApi<PublicKeyCredentialRequestOptionsJSON>('/auth/login-options', { method: 'POST' }),

	login: async (response: AuthenticationResponseJSON): Promise<User> => {
		const result = await fetchApi<AuthResponse>('/auth/login', {
			method: 'POST',
			body: JSON.stringify({ response })
		});
		setAuthToken(result.token);
		return result.user;
	},

	getAddPasskeyOptions: () =>
		fetchApi<PublicKeyCredentialCreationOptionsJSON>('/auth/passkey-options', { method: 'POST' }),

	addPasskey: (response: RegistrationResponseJSON) =>
		fetchApi<{ success: boolean }>('/auth/passkeys', {
			method: 'POST',
			body: JSON.stringify({ response })
		}),

	listPasskeys: () => fetchApi<Passkey[]>('/auth/passkeys'),

	deletePasskey: (id: string) =>
		fetchApi<void>(`/auth/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' }),

	getCurrentUser: () => fetchApi<{ user: User }>('/auth/me').then((res) => res.user),

	logout: () => {
		setAuthToken(null);
		return Promise.resolve();
	},

	isAuthenticated: () => !!authToken
};

// Books API
export const booksApi = {
	getBooks: ({ states, overdue }: { states?: BookState[]; overdue?: boolean } = {}) => {
		const params = new URLSearchParams();
		if (states?.length) params.set('states', states.join(','));
		if (overdue) params.set('overdue', 'true');
		const query = params.toString();
		return fetchApi<Book[]>(`/books${query ? `?${query}` : ''}`);
	},

	// Which still-out books are in this photo? Changes nothing on its own.
	identifyInPhoto: (image: { data: string; mimeType: string }) =>
		fetchApi<PhotoMatches>('/books/identify', {
			method: 'POST',
			body: JSON.stringify({ image: image.data, mimeType: image.mimeType })
		}),

	updateStates: (updates: Array<{ id: string; state: BookState }>) =>
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
