import type {
	Book,
	BookState,
	LibraryCard,
	PasskeyCredential,
	PasskeyLoginRequest,
	PasskeyRegistrationRequest,
	User
} from './types';
import { LibrarySystem } from './types';

// Use the Vercel deployment URL in production, or local API in development
const API_BASE_URL =
	import.meta.env.PUBLIC_API_BASE_URL ||
	(import.meta.env.DEV ? 'http://localhost:3000/api' : 'https://libtrack-api.vercel.app/api');

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
	const response = await fetch(`${API_BASE_URL}${endpoint}`, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			'X-Requested-With': 'XMLHttpRequest',
			...options.headers
		},
		credentials: 'include'
	});

	if (!response.ok) {
		throw new Error(`API error: ${response.statusText}`);
	}

	return response.json();
}

// Auth API
export const authApi = {
	register: (data: PasskeyRegistrationRequest) =>
		fetchApi<User>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

	login: (data: PasskeyLoginRequest) =>
		fetchApi<{ token: string; user: User }>('/auth/login', {
			method: 'POST',
			body: JSON.stringify(data)
		})
};

// Books API
export const booksApi = {
	getBooks: (states?: BookState[]) =>
		fetchApi<Book[]>(`/books${states ? `?states=${states.join(',')}` : ''}`),

	updateBookStates: (
		updates: Array<{ id: string; isbn: string; state: BookState; dueDate?: string }>
	) => fetchApi<Book[]>('/books/states', { method: 'PUT', body: JSON.stringify(updates) })
};

// Library Cards API
export const libraryCardsApi = {
	getLibraryCards: () => fetchApi<LibraryCard[]>('/library-cards'),

	createLibraryCard: (data: {
		number: string;
		pin: string;
		displayName: string;
		system: LibrarySystem;
	}) => fetchApi<LibraryCard>('/library-cards', { method: 'POST', body: JSON.stringify(data) }),

	updateLibraryCard: (
		id: string,
		data: { number: string; pin: string; displayName: string; system: LibrarySystem }
	) => fetchApi<LibraryCard>(`/library-cards/${id}`, { method: 'PUT', body: JSON.stringify(data) })
};
