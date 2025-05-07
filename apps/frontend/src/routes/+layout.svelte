<script lang="ts">
	import '../app.css';
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
					<a
						href="/books"
						class="inline-flex items-center px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md hover:text-gray-900"
						>Books</a
					>
					<a
						href="/library-cards"
						class="inline-flex items-center px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md hover:text-gray-900"
						>Library Cards</a
					>
				</div>
			</div>
		</div>
	</nav>

	<main class="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
		<slot />
	</main>
</div>
