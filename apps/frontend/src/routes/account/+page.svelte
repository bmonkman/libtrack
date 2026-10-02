<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { Writable } from 'svelte/store';
	import { startRegistration } from '@simplewebauthn/browser';
	import { authApi } from '$lib/api';
	import type { Passkey, User } from '$lib/types';

	const currentUser = getContext('currentUser') as Writable<User | null>;

	let passkeys: Passkey[] = [];
	let loading = true;
	let busy = false;
	let error: string | null = null;
	let message: string | null = null;

	function formatDate(dateString?: string): string {
		if (!dateString) return 'Never';
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		}).format(new Date(dateString));
	}

	async function loadPasskeys() {
		try {
			loading = true;
			error = null;
			passkeys = await authApi.listPasskeys();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load passkeys';
		} finally {
			loading = false;
		}
	}

	async function addPasskey() {
		busy = true;
		error = null;
		message = null;
		try {
			const optionsJSON = await authApi.getAddPasskeyOptions();
			const response = await startRegistration({ optionsJSON });
			await authApi.addPasskey(response);
			message = 'Passkey added';
			await loadPasskeys();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not add passkey';
		} finally {
			busy = false;
		}
	}

	async function removePasskey(passkey: Passkey) {
		if (!confirm(`Remove the passkey added ${formatDate(passkey.createdAt)}?`)) return;

		busy = true;
		error = null;
		message = null;
		try {
			await authApi.deletePasskey(passkey.id);
			message = 'Passkey removed';
			await loadPasskeys();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not remove passkey';
		} finally {
			busy = false;
		}
	}

	function logout() {
		authApi.logout();
		currentUser.set(null);
		goto('/');
	}

	onMount(loadPasskeys);
</script>

<div class="overflow-hidden bg-white shadow sm:rounded-lg">
	<div class="flex items-center justify-between px-4 py-5 sm:px-6">
		<div>
			<h2 class="text-lg font-medium leading-6 text-gray-900">Account</h2>
			{#if $currentUser}
				<p class="mt-1 text-sm text-gray-500">Signed in as {$currentUser.name}</p>
			{/if}
		</div>
		<button
			on:click={logout}
			class="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300"
		>
			Log out
		</button>
	</div>

	<div class="border-t border-gray-200 px-4 py-5 sm:px-6">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="text-base font-medium text-gray-900">Passkeys</h3>
				<p class="mt-1 text-sm text-gray-500">
					Add a passkey to sign in from another device or password manager.
				</p>
			</div>
			<button
				on:click={addPasskey}
				disabled={busy}
				class="inline-flex shrink-0 items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
			>
				Add passkey
			</button>
		</div>

		{#if error}
			<p class="mt-4 text-sm text-red-600">{error}</p>
		{/if}
		{#if message}
			<p class="mt-4 text-sm text-green-700">{message}</p>
		{/if}

		{#if loading}
			<p class="mt-4 text-sm text-gray-500">Loading...</p>
		{:else}
			<ul class="mt-4 divide-y divide-gray-200 rounded-md border border-gray-200">
				{#each passkeys as passkey (passkey.id)}
					<li class="flex items-center justify-between px-4 py-3">
						<div class="text-sm">
							<p class="font-medium text-gray-900">
								{passkey.deviceType === 'multiDevice' ? 'Synced passkey' : 'Device-bound passkey'}
							</p>
							<p class="text-gray-500">
								Added {formatDate(passkey.createdAt)} · Last used {formatDate(passkey.lastUsedAt)}
							</p>
						</div>
						<button
							on:click={() => removePasskey(passkey)}
							disabled={busy || passkeys.length === 1}
							title={passkeys.length === 1 ? "Can't remove your only passkey" : undefined}
							class="rounded-md px-2 py-1 text-sm font-medium text-red-600 hover:bg-gray-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
						>
							Remove
						</button>
					</li>
				{:else}
					<li class="px-4 py-3 text-sm text-gray-500">No passkeys yet.</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
