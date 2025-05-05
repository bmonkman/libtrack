export type BookState = 'checked_out' | 'found' | 'returned' | 'overdue';

export enum LibrarySystem {
	NWPL = 'nwpl'
}

export interface Book {
	id: string;
	isbn: string;
	title: string;
	pictureUrl?: string;
	state: BookState;
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
