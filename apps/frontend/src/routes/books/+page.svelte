<script lang="ts">
	import { onMount } from 'svelte';
	import { booksApi, libraryCardsApi } from '$lib/api';
	import type { Book, LibraryCard } from '$lib/types';
	import { BookState } from '$lib/types';

	let books: Book[] = [];
	let libraryCards: LibraryCard[] = [];
	let libraryCardMap: Map<string, string> = new Map();
	let loading = true;
	let error: string | null = null;
	let selectedState: BookState | 'all' = BookState.CHECKED_OUT;

	const states: (BookState | 'all')[] = [
		'all',
		BookState.CHECKED_OUT,
		BookState.FOUND,
		BookState.RETURNED,
		BookState.OVERDUE
	];

	// Generate thumbnail URL using either the book's pictureUrl or Open Library Covers API as fallback
	function getBookCoverUrl(book: Book): string {
		return book.pictureUrl || `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg`;
	}

	// Format date to a user-friendly string
	function formatDueDate(dateString?: string): string {
		if (!dateString) return 'No due date';

		const date = new Date(dateString);
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		}).format(date);
	}

	// Format date to a relative time string (e.g. "5 days ago" or "in 2 weeks")
	function formatRelativeTime(dateString?: string): string {
		if (!dateString) return '';
		
		const date = new Date(dateString);
		const now = new Date();
		const diffTime = date.getTime() - now.getTime();
		const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
		
		// If the difference is less than a day
		if (Math.abs(diffDays) < 1) {
			const diffHours = Math.round(Math.abs(diffTime) / (1000 * 60 * 60));
			if (diffHours < 1) return diffTime > 0 ? 'soon' : 'today';
			return diffTime > 0 ? `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}` : `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
		}
		
		// If the difference is less than 30 days
		if (Math.abs(diffDays) < 30) {
			return diffDays > 0 
				? `in ${diffDays} day${diffDays !== 1 ? 's' : ''}` 
				: `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ago`;
		}
		
		// If the difference is less than 365 days
		if (Math.abs(diffDays) < 365) {
			const diffWeeks = Math.round(diffDays / 7);
			return diffDays > 0 
				? `in ${diffWeeks} week${diffWeeks !== 1 ? 's' : ''}` 
				: `${Math.abs(diffWeeks)} week${Math.abs(diffWeeks) !== 1 ? 's' : ''} ago`;
		}
		
		// More than a year
		const diffYears = Math.floor(diffDays / 365);
		return diffDays > 0 
			? `in ${diffYears} year${diffYears !== 1 ? 's' : ''}` 
			: `${Math.abs(diffYears)} year${Math.abs(diffYears) !== 1 ? 's' : ''} ago`;
	}

	// Get the display name of a library card by its ID
	function getLibraryCardName(libraryCardId?: string): string {
		if (!libraryCardId) return 'Unknown';
		return libraryCardMap.get(libraryCardId) || 'Unknown';
	}

	// Check if a book is overdue
	function isOverdue(dueDate?: string): boolean {
		if (!dueDate) return false;
		return new Date(dueDate) < new Date();
	}

	async function loadLibraryCards() {
		try {
			libraryCards = await libraryCardsApi.getLibraryCards();
			// Create a map of library card IDs to their display names for quick lookup
			libraryCardMap = new Map(libraryCards.map((card) => [card.id, card.displayName]));
		} catch (e) {
			console.error('Failed to load library cards:', e);
		}
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
			await booksApi.updateStates([{ id: book.id, isbn: book.isbn, state: newState }]);
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

	onMount(async () => {
		await loadLibraryCards();
		await loadBooks();
	});
</script>

<div class="overflow-hidden bg-white shadow sm:rounded-lg">
	<div class="px-4 py-5 sm:px-6">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-medium leading-6 text-gray-900">Books</h2>
			<div class="flex flex-col items-center">
				<div class="mb-1">Filter by:</div>
				<select
					bind:value={selectedState}
					on:change={loadBooks}
					class="mt-1 block w-40 rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
				>
					{#each states as state}
						<option value={state}>{state === 'all' ? 'all' : state}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	{#if error}
		<div class="border-l-4 border-red-400 bg-red-50 p-4">
			<div class="flex">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 000 16zM8.707 7.293a1 1 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 101.414 1.414L10 11.414l1.293 1.293a1 1 001.414-1.414L11.414 10l1.293-1.293a1 1 00-1.414-1.414L10 8.586 8.707 7.293z"
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
					<li
						class="px-4 py-4 sm:px-6 {book.state === BookState.CHECKED_OUT &&
						isOverdue(book.dueDate)
							? 'bg-red-50'
							: ''}"
					>
						<div class="flex items-center">
							<div class="mr-4 h-20 w-14 flex-shrink-0">
								<img
									src={getBookCoverUrl(book)}
									alt="Book cover"
									class="h-full w-full rounded object-cover shadow-sm"
									on:error={handleImageError}
								/>
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex items-center">
									<p class="truncate text-sm font-medium text-indigo-600">{book.title}</p>
									{#if book.state === BookState.CHECKED_OUT && isOverdue(book.dueDate)}
										<span
											class="ml-2 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800"
										>
											Overdue
										</span>
									{/if}
								</div>
								<p class="text-sm text-gray-500">ISBN: {book.isbn}</p>
								{#if book.state === BookState.CHECKED_OUT}
									<p class="mt-1 text-sm text-gray-500">
										<span class={isOverdue(book.dueDate) ? 'font-medium text-red-500' : ''}>
											Due: {formatDueDate(book.dueDate)} 
											<span class="text-xs italic">({formatRelativeTime(book.dueDate)})</span>
										</span>
										{#if book.libraryCardId}
											<span class="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
												Card: {getLibraryCardName(book.libraryCardId)}
											</span>
										{/if}
									</p>
								{/if}
							</div>
							<div
								class="ml-4 flex flex-shrink-0 flex-col items-center space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0"
							>
								{#if book.state !== BookState.FOUND}
									<button
										on:click={() => markAsFound(book)}
										class="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-green-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:w-auto"
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
									class="block w-full rounded-md border-gray-300 px-3 py-1 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
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

		/* Center the header filter dropdown */
		.flex.items-center.justify-between {
			align-items: center;
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

		.flex.items-center > .flex-shrink-0 {
			margin-bottom: 0.5rem;
		}

		.flex-col {
			width: 100%;
			align-items: center;
		}

		.ml-4.flex-shrink-0.flex.flex-col {
			align-items: center;
			margin-left: 0;
			margin-top: 0.5rem;
		}

		.ml-4.flex-shrink-0.flex.flex-col button,
		.ml-4.flex-shrink-0.flex.flex-col select {
			max-width: 200px;
		}

		select,
		button {
			min-height: 38px;
		}
	}

	/* Add responsive styles for header links */
	@media (max-width: 640px) {
		.flex.items-center.justify-between {
			flex-direction: column;
			align-items: flex-start;
		}

		.flex.items-center.justify-between > h2 {
			margin-bottom: 0.5rem;
		}
	}
</style>
