<script lang="ts">
	import '../app.css';
	import { onMount, setContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { authApi, getStoredAuthToken } from '$lib/api';
	import { startRegistration } from '@simplewebauthn/browser';
	import { writable } from 'svelte/store';
	import type { User } from '$lib/types';

	// Store for the current user with proper typing
	const currentUser = writable<User | null>(null);
	const isLoading = writable(true);

	// Make user store available to all components via context
	setContext('currentUser', currentUser);
	setContext('isLoading', isLoading);

	// Function to check authentication
	async function checkAuth() {
		isLoading.set(true);
		if (getStoredAuthToken() || authApi.isAuthenticated()) {
			try {
				const user = await authApi.getCurrentUser();
				currentUser.set(user);
			} catch (error) {
				console.error('Failed to fetch current user:', error);
				// Handle invalid token
				authApi.logout();
				currentUser.set(null);
			}
		}
		isLoading.set(false);
	}

	onMount(async () => {
		// Check authentication status on mount
		await checkAuth();

		// Redirect to login if accessing protected routes while not authenticated
		const protectedRoutes = ['/books', '/library-cards'];
		const isProtectedRoute = protectedRoutes.some((route) => $page.url.pathname.startsWith(route));

		if (isProtectedRoute && !$currentUser && !$isLoading) {
			goto('/');
		}
	});

	// Listen for page navigation events to ensure we're showing the correct UI
	$: {
		if ($page) {
			// This reactive statement will re-run when page changes
			const protectedRoutes = ['/books', '/library-cards'];
			const isProtectedRoute = protectedRoutes.some((route) =>
				$page.url.pathname.startsWith(route)
			);

			if (isProtectedRoute && !$currentUser && !$isLoading) {
				goto('/');
			}
		}
	}

	let passkeyStatus = '';

	// Registers a passkey on this device for the signed-in account (e.g. a second device)
	async function handleAddPasskey() {
		passkeyStatus = '';
		try {
			const optionsJSON = await authApi.getAddPasskeyOptions();
			const response = await startRegistration({ optionsJSON });
			await authApi.addPasskey(response);
			passkeyStatus = 'Passkey added';
		} catch (error) {
			console.error('Add passkey error:', error);
			passkeyStatus = error instanceof Error ? error.message : 'Could not add passkey';
		}
	}

	function handleLogout() {
		authApi.logout();
		currentUser.set(null);
		goto('/');
	}
</script>

<div class="min-h-screen bg-gray-100">
	<nav class="bg-white shadow-lg">
		<div class="mx-auto max-w-7xl px-4">
			<div class="flex h-16 justify-between">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<a href="/" class="text-xl font-bold text-gray-800">LibTrack</a>
					</div>
				</div>
				<div class="flex items-center space-x-4">
					{#if $isLoading}
						<div class="text-sm text-gray-500">Loading...</div>
					{:else if $currentUser}
						<a
							href="/books"
							class="inline-flex items-center rounded-md px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
							>Books</a
						>
						<a
							href="/library-cards"
							class="inline-flex items-center rounded-md px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
							>Library Cards</a
						>
						{#if passkeyStatus}
							<span class="text-sm text-gray-500">{passkeyStatus}</span>
						{/if}
						<button
							on:click={handleAddPasskey}
							class="inline-flex items-center rounded-md px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
							>Add passkey</button
						>
						<button
							on:click={handleLogout}
							class="inline-flex items-center rounded-md px-2 py-1 text-sm font-medium text-red-600 hover:bg-gray-50 hover:text-red-800"
							>Logout</button
						>
					{/if}
				</div>
			</div>
		</div>
	</nav>

	<main class="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
		<slot />
	</main>
</div>
