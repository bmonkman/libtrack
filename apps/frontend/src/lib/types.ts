// Mirrors the backend: where the book is. Overdue is worked out from dueDate, not stored.
export enum BookState {
	CHECKED_OUT = 'checked_out',
	FOUND = 'found',
	RETURNED = 'returned'
}

export enum LibrarySystem {
	NWPL = 'nwpl'
}

export interface Book {
	id: string;
	isbn: string;
	title: string;
	author?: string;
	pictureUrl?: string;
	state: BookState;
	dueDate?: string; // 'YYYY-MM-DD'
	libraryCardId?: string;
}

export interface LibraryCard {
	id: string;
	number: string;
	pin: string;
	displayName: string;
	system: LibrarySystem;
}

export interface User {
	id: string;
	name: string;
}

export interface Passkey {
	id: string;
	// 'multiDevice' passkeys sync between devices (iCloud Keychain, Google Password Manager)
	deviceType: 'singleDevice' | 'multiDevice';
	backedUp: boolean;
	createdAt: string;
	lastUsedAt?: string;
}

// Book ids from POST /books/identify. "maybe" ones are shown unticked for the user to check.
export interface PhotoMatches {
	sure: string[];
	maybe: string[];
}
