<script lang="ts">
	import type { Snippet } from 'svelte';
	import { priceVisibility } from '$lib/stores/price-visibility.svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	$effect(() => {
		document.documentElement.classList.toggle('prices-hidden', priceVisibility.pricesHidden);
		return () => {
			document.documentElement.classList.remove('prices-hidden');
		};
	});
</script>

{@render children()}
