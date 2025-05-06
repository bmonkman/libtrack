export enum BookState {
	CHECKED_OUT = 'checked_out',
	FOUND = 'found',
	RETURNED = 'returned',
	OVERDUE = 'overdue'
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

export interface PasskeyCredential {
	id: string;
	publicKey: string;
	algorithm: string;
	authenticatorAttachment: 'platform' | 'cross-platform';
	transports: ('usb' | 'nfc' | 'ble' | 'internal')[];
}

export interface PasskeyRegistrationRequest {
	name: string;
	credential: PasskeyCredential;
}

export interface PasskeyLoginRequest {
	credentialId: string;
	authenticatorData: string;
	clientDataJSON: string;
	signature: string;
}

export interface User {
	id: string;
	name: string;
	credentials: PasskeyCredential[];
}
