<script lang="ts">
	import { onMount } from 'svelte';
	import { booksApi } from '$lib/api';
	import type { Book } from '$lib/types';
	import { BookState } from '$lib/types';

	let books: Book[] = [];
	let loading = true;
	let error: string | null = null;
	let selectedState: BookState | 'all' = BookState.CHECKED_OUT;

	const states: (BookState | 'all')[] = ['all', BookState.CHECKED_OUT, BookState.FOUND, BookState.RETURNED, BookState.OVERDUE];

	// Generate thumbnail URL using Open Library Covers API
	function getBookCoverUrl(isbn: string): string {
		return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
	}

	// Format date to a user-friendly string
	function formatDueDate(dateString?: string): string {
		if (!dateString) return 'No due date';
		
		const date = new Date(dateString);
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		}).format(date);
	}

	// Check if a book is overdue
	function isOverdue(dueDate?: string): boolean {
		if (!dueDate) return false;
		return new Date(dueDate) < new Date();
	}

	async function loadBooks() {
		try {
			loading = true;
			error = null;
			books = await booksApi.getBooks(selectedState === 'all' ? undefined : [selectedState]);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load books';
		} finally {
			loading = false;
		}
	}

	async function updateBookState(book: Book, newState: BookState) {
		try {
			await booksApi.updateBookStates([{ id: book.id, isbn: book.isbn, state: newState }]);
			await loadBooks();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update book state';
		}
	}

	// Helper function to quickly mark a book as found
	function markAsFound(book: Book) {
		updateBookState(book, BookState.FOUND);
	}

	// Handle image error
	function handleImageError(event: Event) {
		const target = event.target as HTMLImageElement;
		if (target) {
			target.src = 'https://via.placeholder.com/100x140?text=No+Cover';
		}
	}

	onMount(loadBooks);
</script>

<div class="overflow-hidden bg-white shadow sm:rounded-lg">
	<div class="px-4 py-5 sm:px-6">
		<div class="flex items-center justify-between">
			<h2 class="text-lg leading-6 font-medium text-gray-900">Books</h2>
			<select
				bind:value={selectedState}
				on:change={loadBooks}
				class="mt-1 block w-full rounded-md border-gray-300 py-2 pr-10 pl-3 text-base focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
			>
				{#each states as state}
					<option value={state}>{state === 'all' ? 'all' : state}</option>
				{/each}
			</select>
		</div>
	</div>

	{#if error}
		<div class="border-l-4 border-red-400 bg-red-50 p-4">
			<div class="flex">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 101.414 1.414L10 11.414l1.293 1.293a1 1 001.414-1.414L11.414 10l1.293-1.293a1 1 00-1.414-1.414L10 8.586 8.707 7.293z"
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

	{#if loading}
		<div class="px-4 py-5 sm:px-6">
			<p class="text-gray-500">Loading books...</p>
		</div>
	{:else}
		<div class="border-t border-gray-200">
			<ul class="divide-y divide-gray-200">
				{#each books as book}
					<li class="px-4 py-4 sm:px-6">
						<div class="flex items-center">
							<div class="flex-shrink-0 h-20 w-14 mr-4">
								<img
									src={getBookCoverUrl(book.isbn)}
									alt="Book cover"
									class="h-full w-full object-cover shadow-sm rounded"
									on:error={handleImageError}
								/>
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-indigo-600">{book.title}</p>
								<p class="text-sm text-gray-500">ISBN: {book.isbn}</p>
								{#if book.state === BookState.CHECKED_OUT}
									<p class="text-sm text-gray-500 mt-1">
										<span class={isOverdue(book.dueDate) ? 'text-red-500 font-medium' : ''}>
											Due: {formatDueDate(book.dueDate)}
										</span>
									</p>
								{/if}
							</div>
							<div class="ml-4 flex-shrink-0 flex items-center space-x-2">
								{#if book.state !== BookState.FOUND}
									<button
										on:click={() => markAsFound(book)}
										class="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
									>
										Found
									</button>
								{/if}
								<select
									value={book.state}
									on:change={(e) => {
										const target = e.target as HTMLSelectElement;
										updateBookState(book, target.value as BookState);
									}}
									class="mt-1 block w-full rounded-md border-gray-300 py-2 pr-10 pl-3 text-base focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
								>
									{#each states.filter((s) => s !== 'all') as state}
										<option value={state}>{state}</option>
									{/each}
								</select>
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

		select {
			width: 100%;
		}

		img {
			max-width: 100%;
			height: auto;
		}
	}
</style>
