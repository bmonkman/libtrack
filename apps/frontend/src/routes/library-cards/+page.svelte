<script lang="ts">
	import { onMount } from 'svelte';
	import { libraryCardsApi } from '$lib/api';
	import type { LibraryCard, LibrarySystem } from '$lib/types';

	let cards: LibraryCard[] = [];
	let loading = true;
	let error: string | null = null;
	let showCreateForm = false;
	let newCard = { number: '', pin: '', displayName: '', system: LibrarySystem.NWPL };

	async function loadCards() {
		try {
			loading = true;
			error = null;
			cards = await libraryCardsApi.getLibraryCards();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load library cards';
		} finally {
			loading = false;
		}
	}

	async function createCard() {
		try {
			await libraryCardsApi.createLibraryCard(newCard);
			newCard = { number: '', pin: '', displayName: '', system: LibrarySystem.NWPL };
			showCreateForm = false;
			await loadCards();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create library card';
		}
	}

	async function updateCard(card: LibraryCard, updates: { number: string; pin: string; displayName: string; system: LibrarySystem }) {
		try {
			await libraryCardsApi.updateLibraryCard(card.id, updates);
			await loadCards();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update library card';
		}
	}

	onMount(loadCards);
</script>

<div class="overflow-hidden bg-white shadow sm:rounded-lg">
	<div class="px-4 py-5 sm:px-6">
		<div class="flex items-center justify-between">
			<h2 class="text-lg leading-6 font-medium text-gray-900">Library Cards</h2>
			<button
				on:click={() => (showCreateForm = true)}
				class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
			>
				Add Card
			</button>
		</div>
	</div>

	{#if error}
		<div class="border-l-4 border-red-400 bg-red-50 p-4">
			<div class="flex">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<p class="text-sm text-red-700">{error}</p>
				</div>
			</div>
		</div>
	{/if}

	{#if showCreateForm}
		<div class="border-t border-gray-200 px-4 py-5 sm:px-6">
			<h3 class="mb-4 text-lg leading-6 font-medium text-gray-900">Create New Library Card</h3>
			<form on:submit|preventDefault={createCard} class="space-y-4">
				<div>
					<label for="displayName" class="block text-sm font-medium text-gray-700">Display Name</label>
					<input
						type="text"
						id="displayName"
						bind:value={newCard.displayName}
						required
						placeholder="e.g. John's Card"
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
					/>
				</div>
				<div>
					<label for="system" class="block text-sm font-medium text-gray-700">Library System</label>
					<select
						id="system"
						bind:value={newCard.system}
						required
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
					>
						<option value={LibrarySystem.NWPL}>New West Public Library</option>
					</select>
				</div>
				<div>
					<label for="number" class="block text-sm font-medium text-gray-700">Card Number</label>
					<input
						type="text"
						id="number"
						bind:value={newCard.number}
						required
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
					/>
				</div>
				<div>
					<label for="pin" class="block text-sm font-medium text-gray-700">PIN</label>
					<input
						type="text"
						id="pin"
						bind:value={newCard.pin}
						required
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
					/>
				</div>
				<div class="flex justify-end space-x-3">
					<button
						type="button"
						on:click={() => (showCreateForm = false)}
						class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
					>
						Create
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if loading}
		<div class="px-4 py-5 sm:px-6">
			<p class="text-gray-500">Loading library cards...</p>
		</div>
	{:else}
		<div class="border-t border-gray-200">
			<ul class="divide-y divide-gray-200">
				{#each cards as card}
					<li class="px-4 py-4 sm:px-6">
						<div class="flex items-center justify-between">
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-indigo-600">{card.displayName}</p>
								<p class="text-sm text-gray-500">System: {card.system}</p>
								<p class="text-sm text-gray-500">Card #{card.number}</p>
								<p class="text-sm text-gray-500">PIN: {card.pin}</p>
							</div>
							<div class="ml-4 flex-shrink-0">
								<button
									on:click={() => updateCard(card, { number: card.number, pin: card.pin, displayName: card.displayName, system: card.system })}
									class="inline-flex items-center rounded-md border border-transparent bg-indigo-100 px-3 py-1 text-sm leading-4 font-medium text-indigo-700 hover:bg-indigo-200 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
								>
									Update
								</button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
