<script lang="ts">
	import { onMount } from 'svelte';
	import { booksApi, libraryCardsApi } from '$lib/api';
	import type { Book } from '$lib/types';
	import { BookState } from '$lib/types';
	import { daysUntilDue, isOverdue, parseDueDate } from '$lib/dates';
	import { photoToJpegBase64 } from '$lib/image';
	import { formatDollars } from '$lib/money';

	type Filter = 'still_out' | 'found' | 'overdue' | 'returned' | 'all';

	const filters: { value: Filter; label: string }[] = [
		{ value: 'still_out', label: 'Still out' },
		{ value: 'found', label: 'Found' },
		{ value: 'overdue', label: 'Overdue' },
		{ value: 'returned', label: 'Returned' },
		{ value: 'all', label: 'All' }
	];

	const stateLabels: Record<BookState, string> = {
		[BookState.CHECKED_OUT]: 'Still out',
		[BookState.FOUND]: 'Found',
		[BookState.RETURNED]: 'Returned'
	};

	let books: Book[] = [];
	let libraryCardMap: Map<string, string> = new Map();
	let loading = true;
	let error: string | null = null;
	let selectedFilter: Filter = 'still_out';
	// Books with a state change in flight, so their buttons can't be double-clicked
	let pendingIds = new Set<string>();

	// Photo matching: the model suggests which still-out books are in a photo, and nothing is
	// marked found until the user confirms the ticked ones.
	let photoInput: HTMLInputElement;
	let photoStatus: 'idle' | 'checking' | 'saving' = 'idle';
	let review: { sure: Book[]; maybe: Book[] } | null = null;
	let ticked = new Set<string>();
	let photoMessage: string | null = null;

	async function handlePhoto(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // so choosing the same photo again still triggers a change
		if (!file) return;

		photoStatus = 'checking';
		error = null;
		photoMessage = null;
		try {
			const matches = await booksApi.identifyInPhoto(await photoToJpegBase64(file));
			const byId = new Map(books.map((book) => [book.id, book]));
			const pick = (ids: string[]) =>
				ids.map((id) => byId.get(id)).filter((book): book is Book => !!book);
			review = { sure: pick(matches.sure), maybe: pick(matches.maybe) };
			ticked = new Set(review.sure.map((book) => book.id));
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not check the photo';
		} finally {
			photoStatus = 'idle';
		}
	}

	function toggleTicked(id: string) {
		ticked = new Set(ticked);
		if (!ticked.delete(id)) ticked.add(id);
	}

	async function confirmPhotoMatches() {
		photoStatus = 'saving';
		error = null;
		try {
			const updated = await booksApi.updateStates(
				[...ticked].map((id) => ({ id, state: BookState.FOUND }))
			);
			const saved = new Map(updated.map((book) => [book.id, book]));
			books = books
				.map((book) => saved.get(book.id) ?? book)
				.filter((book) => matchesFilter(book, selectedFilter));
			const missed = ticked.size - saved.size;
			photoMessage =
				`Marked ${saved.size} found.` +
				(missed ? ` ${missed} couldn't be saved; reload to check them.` : '');
			review = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not mark the books found';
		} finally {
			photoStatus = 'idle';
		}
	}

	function query(filter: Filter) {
		switch (filter) {
			case 'still_out':
				return { states: [BookState.CHECKED_OUT] };
			case 'found':
				return { states: [BookState.FOUND] };
			case 'returned':
				return { states: [BookState.RETURNED] };
			case 'overdue':
				return { overdue: true };
			case 'all':
				return {};
		}
	}

	// Whether a book still belongs in the current list after its state changes
	function matchesFilter(book: Book, filter: Filter): boolean {
		switch (filter) {
			case 'still_out':
				return book.state === BookState.CHECKED_OUT;
			case 'found':
				return book.state === BookState.FOUND;
			case 'returned':
				return book.state === BookState.RETURNED;
			case 'overdue':
				return book.state !== BookState.RETURNED && isOverdue(book.dueDate);
			case 'all':
				return true;
		}
	}

	// Use either the book's pictureUrl or the Open Library Covers API as fallback
	function getBookCoverUrl(book: Book): string {
		// default=false makes Open Library 404 instead of returning a blank 1x1 image
		return (
			book.pictureUrl || `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg?default=false`
		);
	}

	function formatDueDate(dueDate?: string): string {
		if (!dueDate) return 'No due date';
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		}).format(parseDueDate(dueDate));
	}

	function formatRelativeDue(dueDate?: string): string {
		if (!dueDate) return '';
		const days = daysUntilDue(dueDate);
		if (days === 0) return 'today';
		if (days === 1) return 'tomorrow';
		if (days === -1) return 'yesterday';
		if (Math.abs(days) < 14) return days > 0 ? `in ${days} days` : `${-days} days ago`;
		const weeks = Math.round(Math.abs(days) / 7);
		return days > 0 ? `in ${weeks} weeks` : `${weeks} weeks ago`;
	}

	async function loadLibraryCards() {
		try {
			const libraryCards = await libraryCardsApi.getLibraryCards();
			libraryCardMap = new Map(libraryCards.map((card) => [card.id, card.displayName]));
		} catch (e) {
			console.error('Failed to load library cards:', e);
		}
	}

	async function loadBooks() {
		try {
			loading = true;
			error = null;
			books = await booksApi.getBooks(query(selectedFilter));
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load books';
		} finally {
			loading = false;
		}
	}

	// Updates just this book in the list (or drops it if it no longer matches the filter) instead
	// of reloading, so the page doesn't jump back to the top.
	async function updateBookState(book: Book, newState: BookState) {
		if (book.state === newState || pendingIds.has(book.id)) return;

		pendingIds = new Set(pendingIds).add(book.id);
		error = null;
		try {
			const [updated] = await booksApi.updateStates([{ id: book.id, state: newState }]);
			// The API skips ids it can't find (e.g. deleted elsewhere), so no result means no save
			if (!updated) {
				throw new Error('That book no longer exists. Reload the page to refresh the list.');
			}
			books = matchesFilter(updated, selectedFilter)
				? books.map((b) => (b.id === book.id ? updated : b))
				: books.filter((b) => b.id !== book.id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update book state';
		} finally {
			pendingIds.delete(book.id);
			pendingIds = new Set(pendingIds);
		}
	}

	// Swap in a local placeholder once; clearing the handler stops a loop if that fails too
	function handleImageError(event: Event) {
		const target = event.target as HTMLImageElement;
		target.onerror = null;
		target.src = '/book-placeholder.svg';
	}

	onMount(async () => {
		await Promise.all([loadLibraryCards(), loadBooks()]);
	});
</script>

<div class="overflow-hidden bg-white shadow sm:rounded-lg">
	<div class="px-4 py-5 sm:px-6">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-medium leading-6 text-gray-900">Books</h2>
			<div class="flex flex-col items-center">
				<div class="mb-1">Filter by:</div>
				<select
					bind:value={selectedFilter}
					on:change={loadBooks}
					disabled={photoStatus !== 'idle' || !!review}
					title={review ? 'Finish or cancel the photo review first' : undefined}
					class="mt-1 block w-40 rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
				>
					{#each filters as filter (filter.value)}
						<option value={filter.value}>{filter.label}</option>
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

	{#if selectedFilter === 'still_out' && !loading && !review && books.length > 0}
		<div class="border-t border-gray-200 px-4 py-3 sm:px-6">
			<input
				bind:this={photoInput}
				type="file"
				accept="image/*"
				capture="environment"
				class="hidden"
				on:change={handlePhoto}
			/>
			<button
				on:click={() => photoInput.click()}
				disabled={photoStatus !== 'idle'}
				class="w-full rounded-md border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 sm:w-auto"
			>
				{photoStatus === 'checking'
					? 'Looking for your books… this takes a few seconds'
					: 'Find books in a photo'}
			</button>
			{#if photoMessage}
				<p class="mt-2 text-sm text-green-700">{photoMessage}</p>
			{/if}
		</div>
	{/if}

	{#if loading}
		<div class="px-4 py-5 sm:px-6">
			<p class="text-gray-500">Loading books...</p>
		</div>
	{:else if review}
		<div class="border-t border-gray-200 bg-gray-100 p-3 sm:bg-white sm:p-6">
			{#if review.sure.length + review.maybe.length === 0}
				<h3 class="text-base font-medium text-gray-900">
					None of your still-out books were spotted in that photo
				</h3>
				<p class="mt-1 text-sm text-gray-500">
					Try a photo with the covers facing up, or tap Found on each book instead.
				</p>
			{:else}
				<h3 class="text-base font-medium text-gray-900">Found in your photo</h3>
				<p class="mt-1 text-sm text-gray-500">
					Untick any that aren't really there, then mark the rest found.
				</p>
				{#each [{ heading: '', books: review.sure }, { heading: 'Not sure. Tick these if they are there', books: review.maybe }] as group (group.heading)}
					{#if group.books.length}
						{#if group.heading}
							<h4 class="mt-4 text-sm font-medium text-gray-700">{group.heading}</h4>
						{/if}
						<ul class="mt-2 space-y-2">
							{#each group.books as book (book.id)}
								<li>
									<label
										class="grid cursor-pointer grid-cols-[auto_auto_1fr] items-center gap-3 rounded-lg border border-gray-300 bg-white p-3"
									>
										<input
											type="checkbox"
											checked={ticked.has(book.id)}
											on:change={() => toggleTicked(book.id)}
											class="h-6 w-6 flex-shrink-0 rounded border-gray-400 text-green-600"
										/>
										<img
											src={getBookCoverUrl(book)}
											alt=""
											class="h-16 w-12 flex-shrink-0 rounded object-cover"
											on:error={handleImageError}
										/>
										<span class="min-w-0">
											<span class="block truncate text-sm font-medium text-indigo-600"
												>{book.title}</span
											>
											{#if book.author}
												<span class="block text-sm text-gray-700">{book.author}</span>
											{/if}
										</span>
									</label>
								</li>
							{/each}
						</ul>
					{/if}
				{/each}
			{/if}
			<div class="mt-4 flex gap-2">
				{#if review.sure.length + review.maybe.length > 0}
					<button
						on:click={confirmPhotoMatches}
						disabled={ticked.size === 0 || photoStatus !== 'idle'}
						class="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50 sm:flex-none"
					>
						Mark {ticked.size} found
					</button>
				{/if}
				<button
					on:click={() => (review = null)}
					disabled={photoStatus !== 'idle'}
					class="flex-1 rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300 sm:flex-none"
				>
					{review.sure.length + review.maybe.length > 0 ? 'Cancel' : 'Back to the list'}
				</button>
			</div>
		</div>
	{:else}
		<!-- On phones each book is its own card, so its Found button clearly belongs to it -->
		<div class="border-t border-gray-200 bg-gray-100 p-3 sm:bg-white sm:p-0">
			<ul class="space-y-3 sm:space-y-0 sm:divide-y sm:divide-gray-300">
				{#each books as book (book.id)}
					{@const overdue = book.state !== BookState.RETURNED && isOverdue(book.dueDate)}
					<li
						class="rounded-lg border px-4 py-4 shadow-sm sm:rounded-none sm:border-0 sm:px-6 sm:shadow-none {overdue
							? 'border-red-300 bg-red-50'
							: 'border-gray-300 bg-white'}"
					>
						<div class="flex items-center">
							<div class="h-24 w-[4.2rem] flex-shrink-0 self-center sm:mr-4 sm:self-auto">
								<img
									src={getBookCoverUrl(book)}
									alt="Book cover"
									class="h-full w-full rounded object-cover shadow-sm"
									on:error={handleImageError}
								/>
							</div>
							<!-- Phones stack the cover, text and buttons in one centered column -->
							<div class="min-w-0 flex-1 text-center sm:text-left">
								<div class="flex items-center">
									<p class="truncate text-sm font-medium text-indigo-600">{book.title}</p>
									{#if book.lostChargeCents}
										<span
											class="inline-flex items-center self-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 sm:ml-2 sm:self-auto"
										>
											Library says lost: {formatDollars(book.lostChargeCents)}
										</span>
									{/if}
									{#if overdue}
										<span
											class="inline-flex items-center self-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 sm:ml-2 sm:self-auto"
										>
											Overdue
										</span>
									{/if}
								</div>
								{#if book.author}
									<p class="text-sm text-gray-700">{book.author}</p>
								{/if}
								<p class="text-sm text-gray-500">ISBN: {book.isbn}</p>
								{#if book.state !== BookState.RETURNED}
									<p class="mt-1 text-sm text-gray-500">
										<span class={overdue ? 'font-medium text-red-500' : ''}>
											Due: {formatDueDate(book.dueDate)}
											<span class="text-xs italic">({formatRelativeDue(book.dueDate)})</span>
										</span>
										{#if book.libraryCardId}
											<span
												class="ml-2 inline-block whitespace-nowrap rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
											>
												Card: {libraryCardMap.get(book.libraryCardId) ?? 'Unknown'}
											</span>
										{/if}
									</p>
								{/if}
							</div>
							<div
								class="ml-4 flex flex-shrink-0 flex-col items-center space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0"
							>
								{#if book.state === BookState.CHECKED_OUT}
									<button
										on:click={() => updateBookState(book, BookState.FOUND)}
										disabled={pendingIds.has(book.id)}
										class="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-green-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 sm:w-auto"
									>
										Found
									</button>
								{/if}
								<select
									value={book.state}
									disabled={pendingIds.has(book.id)}
									on:change={(e) => {
										// Put the control back until the save succeeds; the list update then
										// selects the new state, and a failed save leaves the real one showing
										const target = e.target as HTMLSelectElement;
										const newState = target.value as BookState;
										target.value = book.state;
										updateBookState(book, newState);
									}}
									class="block w-full rounded-md border-gray-300 px-3 py-1 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
								>
									{#each Object.values(BookState) as state (state)}
										<option value={state}>{stateLabels[state]}</option>
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
