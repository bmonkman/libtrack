<script lang="ts">
	import '../app.css';
	import { onMount, setContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ApiError, authApi, getStoredAuthToken, setSessionEndedHandler } from '$lib/api';
	import { writable } from 'svelte/store';
	import type { User } from '$lib/types';

	// Store for the current user with proper typing
	const currentUser = writable<User | null>(null);
	const isLoading = writable(true);
	// The sign-in check failed for a reason other than an invalid session (offline, server down)
	let authCheckFailed = false;

	// Make user store available to all components via context
	setContext('currentUser', currentUser);
	setContext('isLoading', isLoading);

	setSessionEndedHandler(() => {
		currentUser.set(null);
		goto('/');
	});

	// Function to check authentication
	async function checkAuth() {
		isLoading.set(true);
		authCheckFailed = false;
		if (getStoredAuthToken() || authApi.isAuthenticated()) {
			try {
				const user = await authApi.getCurrentUser();
				currentUser.set(user);
			} catch (error) {
				console.error('Failed to fetch current user:', error);
				// Only a 401 means the session is gone (fetchApi has already dropped the token).
				// Anything else, like a phone still reconnecting after being in the background,
				// keeps the token so the user stays signed in and can retry.
				currentUser.set(null);
				authCheckFailed = !(error instanceof ApiError && error.status === 401);
			}
		}
		isLoading.set(false);
	}

	onMount(async () => {
		// Check authentication status on mount
		await checkAuth();

		// Redirect to login if accessing protected routes while not authenticated
		const protectedRoutes = ['/books', '/library-cards', '/account'];
		const isProtectedRoute = protectedRoutes.some((route) => $page.url.pathname.startsWith(route));

		if (isProtectedRoute && !$currentUser && !$isLoading && !authCheckFailed) {
			goto('/');
		}
	});

	// Listen for page navigation events to ensure we're showing the correct UI
	$: {
		if ($page) {
			// This reactive statement will re-run when page changes
			const protectedRoutes = ['/books', '/library-cards', '/account'];
			const isProtectedRoute = protectedRoutes.some((route) =>
				$page.url.pathname.startsWith(route)
			);

			if (isProtectedRoute && !$currentUser && !$isLoading && !authCheckFailed) {
				goto('/');
			}
		}
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
						<a
							href="/account"
							class="inline-flex items-center rounded-md px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
							>Account</a
						>
					{/if}
				</div>
			</div>
		</div>
	</nav>

	<main class="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
		{#if authCheckFailed}
			<div class="bg-white px-4 py-5 text-center shadow sm:rounded-lg sm:px-6">
				<p class="text-gray-900">Couldn't reach LibTrack. You're still signed in.</p>
				<button
					on:click={checkAuth}
					class="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
				>
					Try again
				</button>
			</div>
		{:else}
			<slot />
		{/if}
	</main>
</div>
