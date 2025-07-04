<script lang="ts">
	import { onMount } from 'svelte';
	import { libraryCardsApi } from '$lib/api';
	import type { LibraryCard } from '$lib/types';
	import { LibrarySystem } from '$lib/types';
	import JsBarcode from 'jsbarcode';

	let cards: LibraryCard[] = [];
	let loading = true;
	let error: string | null = null;
	let showCreateForm = false;
	let editingCard: LibraryCard | null = null;
	let newCard = { number: '', pin: '', displayName: '', system: LibrarySystem.NWPL };

	function generateBarcode(cardNumber: string, elementId: string) {
		const canvas = document.getElementById(elementId) as HTMLCanvasElement;
		if (canvas) {
			JsBarcode(canvas, cardNumber, {
				format: 'CODE128',
				width: 2,
				height: 120,
				displayValue: false
			});
		}
	}

	function showBarcodePopup(cardNumber: string) {
		const popup = window.open('', '_blank', 'width=400,height=200');
		if (popup) {
			popup.document.write(
				'<html><head><title>Barcode</title></head><body style="display:flex;justify-content:center;align-items:center;height:100%;margin:0;"><canvas id="popup-barcode"></canvas></body></html>'
			);
			popup.document.close();
			const canvas = popup.document.getElementById('popup-barcode') as HTMLCanvasElement;
			if (canvas) {
				JsBarcode(canvas, cardNumber, {
					format: 'CODE128',
					width: 3,
					height: 150,
					displayValue: true
				});
			}
		}
	}

	async function loadCards() {
		try {
			loading = true;
			error = null;
			cards = await libraryCardsApi.getLibraryCards();
			// Generate barcodes after cards are loaded
			cards.forEach((card) => {
				setTimeout(() => generateBarcode(card.number, `barcode-${card.id}`), 0);
			});
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load library cards';
		} finally {
			loading = false;
		}
	}

	async function createCard() {
		try {
			await libraryCardsApi.addLibraryCard(newCard);
			newCard = { number: '', pin: '', displayName: '', system: LibrarySystem.NWPL };
			showCreateForm = false;
			await loadCards();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create library card';
		}
	}

	async function updateCard(
		card: LibraryCard,
		updates: { number: string; pin: string; displayName: string; system: LibrarySystem }
	) {
		try {
			await libraryCardsApi.updateLibraryCard({ id: card.id, ...updates });
			editingCard = null;
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
			<h2 class="text-lg font-medium leading-6 text-gray-900">Library Cards</h2>
			<button
				on:click={() => (showCreateForm = true)}
				class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
			<h3 class="mb-4 text-lg font-medium leading-6 text-gray-900">Create New Library Card</h3>
			<form on:submit|preventDefault={createCard} class="space-y-4">
				<div>
					<label for="displayName" class="block text-sm font-medium text-gray-700"
						>Display Name</label
					>
					<input
						type="text"
						id="displayName"
						bind:value={newCard.displayName}
						required
						placeholder="e.g. John's Card"
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
					/>
				</div>
				<div>
					<label for="system" class="block text-sm font-medium text-gray-700">Library System</label>
					<select
						id="system"
						bind:value={newCard.system}
						required
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
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
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
					/>
				</div>
				<div>
					<label for="pin" class="block text-sm font-medium text-gray-700">PIN</label>
					<input
						type="text"
						id="pin"
						bind:value={newCard.pin}
						required
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
					/>
				</div>
				<div class="flex justify-end space-x-3">
					<button
						type="button"
						on:click={() => (showCreateForm = false)}
						class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
							</div>
							<div class="flex items-center space-x-4">
								<canvas id="barcode-{card.id}" class="h-16 w-auto"></canvas>
								<button
									on:click={() => showBarcodePopup(card.number)}
									class="inline-flex items-center rounded-md border border-transparent bg-indigo-100 px-3 py-1 text-sm font-medium leading-4 text-indigo-700 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
								>
									Show Barcode
								</button>
								{#if editingCard?.id === card.id}
									<form
										on:submit|preventDefault={() => editingCard && updateCard(card, {
											number: editingCard.number,
											pin: editingCard.pin,
											displayName: editingCard.displayName,
											system: editingCard.system
										})}
										class="flex items-center space-x-2"
									>
										<input
											type="text"
											bind:value={editingCard.displayName}
											placeholder="Display Name"
											class="rounded-md border border-gray-300 px-2 py-1 text-sm"
										/>
										<input
											type="text"
											bind:value={editingCard.number}
											placeholder="Card Number"
											class="rounded-md border border-gray-300 px-2 py-1 text-sm"
										/>
										<input
											type="text"
											bind:value={editingCard.pin}
											placeholder="PIN"
											class="rounded-md border border-gray-300 px-2 py-1 text-sm"
										/>
										<button
											type="submit"
											class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
										>
											Save
										</button>
										<button
											type="button"
											on:click={() => (editingCard = null)}
											class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
										>
											Cancel
										</button>
									</form>
								{:else}
									<button
										on:click={() => (editingCard = { ...card })}
										class="inline-flex items-center rounded-md border border-transparent bg-indigo-100 px-3 py-1 text-sm font-medium leading-4 text-indigo-700 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
									>
										Edit
									</button>
								{/if}
							</div>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	/* Add responsive styles */
	@media (max-width: 640px) {
		.flex {
			flex-direction: column;
			align-items: flex-start;
		}

		.flex.items-center {
			align-items: stretch;
		}

		.flex.items-center > * {
			margin-bottom: 0.5rem;
		}

		.flex.items-center > *:last-child {
			margin-bottom: 0;
		}

		button {
			width: 100%;
		}

		canvas {
			max-width: 100%;
			height: auto;
		}
	}
</style>
