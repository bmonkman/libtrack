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

export interface PasskeyCredential {
	id: string;
	publicKey: string;
	algorithm: string;
	authenticatorAttachment: 'platform' | 'cross-platform';
	transports: ('usb' | 'nfc' | 'ble' | 'internal')[];
}

export interface PublicKeyCredentialCreationOptions {
	challenge: ArrayBuffer;
	rp: {
		name: string;
		id?: string;
	};
	user: {
		id: ArrayBuffer;
		name: string;
		displayName: string;
	};
	pubKeyCredParams: {
		type: 'public-key';
		alg: number;
	}[];
	timeout?: number;
	excludeCredentials?: {
		id: ArrayBuffer;
		type: 'public-key';
		transports?: string[];
	}[];
	authenticatorSelection?: {
		authenticatorAttachment?: 'platform' | 'cross-platform';
		requireResidentKey?: boolean;
		residentKey?: 'required' | 'preferred' | 'discouraged';
		userVerification?: 'required' | 'preferred' | 'discouraged';
	};
	attestation?: 'none' | 'direct' | 'indirect' | 'enterprise';
}

export interface PublicKeyCredentialRequestOptions {
	challenge: ArrayBuffer;
	timeout?: number;
	rpId?: string;
	allowCredentials?: {
		id: ArrayBuffer;
		type: 'public-key';
		transports?: string[];
	}[];
	userVerification?: 'required' | 'preferred' | 'discouraged';
}

export interface RegistrationCredentialJSON {
	id: string;
	rawId: string;
	response: {
		attestationObject: string;
		clientDataJSON: string;
	};
	type: string;
}

export interface AuthenticationCredentialJSON {
	id: string;
	rawId: string;
	response: {
		authenticatorData: string;
		clientDataJSON: string;
		signature: string;
		userHandle: string | null;
	};
	type: string;
}

export interface PasskeyRegistrationRequest {
	name: string;
	credential: RegistrationCredentialJSON;
}

export interface PasskeyLoginRequest {
	credential: AuthenticationCredentialJSON;
}

export interface User {
	id: string;
	name: string;
	credentials: PasskeyCredential[];
}
