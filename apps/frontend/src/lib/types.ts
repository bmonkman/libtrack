export enum BookState {
	CHECKED_OUT = 'checked_out',
	AVAILABLE = 'available',
	OVERDUE = 'overdue',
	ON_HOLD = 'on_hold',
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
	pictureUrl?: string;
	state: BookState;
	dueDate?: string;
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
