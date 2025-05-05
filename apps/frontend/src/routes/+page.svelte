<script lang="ts">
	import { booksApi } from '$lib/api';
	import type { Book } from '$lib/types';
	import { onMount } from 'svelte';

	let books: Book[] = [];
	let loading = true;
	let error: string | null = null;

	async function loadBooks() {
		try {
			loading = true;
			error = null;
			books = await booksApi.getBooks(['checked_out']);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load books';
		} finally {
			loading = false;
		}
	}

	onMount(loadBooks);
</script>

<div class="overflow-hidden bg-white shadow sm:rounded-lg">
	<div class="px-4 py-5 sm:px-6">
		<h2 class="text-lg leading-6 font-medium text-gray-900">Welcome to LibTrack</h2>
		<p class="mt-1 max-w-2xl text-sm text-gray-500">Your library management system</p>
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

	<div class="border-t border-gray-200">
		<div class="px-4 py-5 sm:px-6">
			<h3 class="text-lg leading-6 font-medium text-gray-900">Currently Checked Out Books</h3>
			{#if loading}
				<p class="mt-2 text-sm text-gray-500">Loading books...</p>
			{:else if books.length === 0}
				<p class="mt-2 text-sm text-gray-500">No books are currently checked out.</p>
			{:else}
				<ul class="mt-4 divide-y divide-gray-200">
					{#each books as book}
						<li class="py-4">
							<div class="flex space-x-3">
								{#if book.pictureUrl}
									<img class="h-10 w-10 rounded-full" src={book.pictureUrl} alt={book.title} />
								{:else}
									<div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
										<svg
											class="h-6 w-6 text-gray-400"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
											/>
										</svg>
									</div>
								{/if}
								<div class="flex-1 space-y-1">
									<div class="flex items-center justify-between">
										<h3 class="text-sm font-medium">{book.title}</h3>
										<p class="text-sm text-gray-500">ISBN: {book.isbn}</p>
									</div>
									<p class="text-sm text-gray-500">
										Checked out to: {book.libraryCardId || 'Not assigned'}
									</p>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>
