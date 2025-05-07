<script lang="ts">
	import type { User } from '$lib/types';
	import { authApi, getStoredAuthToken } from '$lib/api';
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';

	// Authentication states
	const AUTH_STATE = {
		INITIAL: 'initial',
		REGISTER: 'register',
		LOADING: 'loading'
	};

	// Get the shared user store from context
	const currentUser = getContext('currentUser');
	const isLoading = getContext('isLoading');

	let authState = AUTH_STATE.INITIAL;
	let userName = '';
	let error = '';
	let isCheckingAuth = false;

	onMount(() => {
		// If user is already authenticated, redirect to books page
		if ($currentUser) {
			goto('/books');
		}
	});

	async function handleRegister() {
		if (!userName.trim()) {
			error = 'Please enter your name';
			return;
		}

		authState = AUTH_STATE.LOADING;
		error = '';

		try {
			// Using WebAuthn API for passkey registration
			// 1. Get registration options from server
			const options = await authApi.getRegistrationOptions(userName);

			// 2. Create credentials using browser's WebAuthn API
			// Type assertion to handle compatibility between our custom types and the browser API
			const credential = (await navigator.credentials.create({
				publicKey: options as unknown as PublicKeyCredentialCreationOptions
			})) as PublicKeyCredential;

			// 3. Prepare credential for server
			const credentialResponse = credential.response as AuthenticatorAttestationResponse;
			const credentialData = {
				id: credential.id,
				rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
				response: {
					attestationObject: btoa(
						String.fromCharCode(...new Uint8Array(credentialResponse.attestationObject))
					),
					clientDataJSON: btoa(
						String.fromCharCode(...new Uint8Array(credentialResponse.clientDataJSON))
					)
				},
				type: credential.type
			};

			// 4. Register the user with their credential
			const user = await authApi.register({
				name: userName,
				credential: credentialData
			});

			currentUser.set(user);
			goto('/books');
		} catch (err) {
			console.error('Registration error:', err);
			error = err instanceof Error ? err.message : 'Registration failed';
			authState = AUTH_STATE.REGISTER;
		}
	}

	async function handleLogin() {
		authState = AUTH_STATE.LOADING;
		error = '';

		try {
			// Using WebAuthn API for passkey login
			// 1. Get login options from server
			const options = await authApi.getLoginOptions();

			// 2. Get credentials using browser's WebAuthn API
			// Type assertion to handle compatibility between our custom types and the browser API
			const credential = (await navigator.credentials.get({
				publicKey: options as unknown as PublicKeyCredentialRequestOptions
			})) as PublicKeyCredential;

			// 3. Prepare credential for server
			const credentialResponse = credential.response as AuthenticatorAssertionResponse;
			const loginData = {
				credential: {
					id: credential.id,
					rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
					response: {
						authenticatorData: btoa(
							String.fromCharCode(...new Uint8Array(credentialResponse.authenticatorData))
						),
						clientDataJSON: btoa(
							String.fromCharCode(...new Uint8Array(credentialResponse.clientDataJSON))
						),
						signature: btoa(String.fromCharCode(...new Uint8Array(credentialResponse.signature))),
						userHandle: credentialResponse.userHandle
							? btoa(String.fromCharCode(...new Uint8Array(credentialResponse.userHandle)))
							: null
					},
					type: credential.type
				}
			};

			// 4. Verify the credential with the server
			const user = await authApi.login(loginData);
			currentUser.set(user);
			goto('/books');
		} catch (err) {
			console.error('Login error:', err);
			error = err instanceof Error ? err.message : 'Login failed';
			authState = AUTH_STATE.INITIAL;
		}
	}
</script>

<div class="m-6 mx-auto max-w-md overflow-hidden rounded-xl bg-white shadow-md md:max-w-2xl">
	<div class="p-8">
		{#if $isLoading}
			<div class="flex items-center justify-center py-6">
				<p class="text-gray-600">Checking authentication status...</p>
			</div>
		{:else}
			<div class="text-center">
				<h1 class="text-2xl font-bold text-gray-900">Welcome to LibTrack</h1>
				<p class="mt-2 text-gray-600">Track your library books across multiple libraries</p>
			</div>

			{#if authState === AUTH_STATE.REGISTER}
				<div class="mt-6">
					<input
						type="text"
						bind:value={userName}
						placeholder="Enter your name"
						class="w-full rounded-md border px-3 py-2 focus:border-indigo-500 focus:outline-none"
					/>
					{#if error}
						<p class="mt-2 text-sm text-red-500">{error}</p>
					{/if}
					<div class="mt-4 flex justify-between">
						<button
							on:click={() => (authState = AUTH_STATE.INITIAL)}
							class="rounded-md bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300"
						>
							Back
						</button>
						<button
							on:click={handleRegister}
							class="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
						>
							Register
						</button>
					</div>
				</div>
			{:else if authState === AUTH_STATE.LOADING}
				<div class="mt-6 flex items-center justify-center py-4">
					<div
						class="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
					></div>
					<span class="ml-2 text-gray-600">Processing...</span>
				</div>
			{:else}
				<div class="mt-6 grid grid-cols-1 gap-3">
					<button
						on:click={handleLogin}
						class="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
					>
						Sign in with passkey
					</button>
					<button
						on:click={() => (authState = AUTH_STATE.REGISTER)}
						class="rounded-md bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300"
					>
						Register new account
					</button>
					{#if error}
						<p class="mt-2 text-sm text-red-500">{error}</p>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>
