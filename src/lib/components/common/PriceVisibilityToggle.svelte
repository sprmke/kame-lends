<script lang="ts">
	import { Eye, EyeOff } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { priceVisibility } from '$lib/stores/price-visibility.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();

	const pricesHidden = $derived(priceVisibility.pricesHidden);
</script>

<Button
	type="button"
	variant="outline"
	size="icon"
	class={cn('h-9 w-9 shrink-0', className)}
	onclick={() => priceVisibility.togglePricesHidden()}
	title={pricesHidden
		? 'Show sensitive data (names, amounts, dates, rates)'
		: 'Hide sensitive data (names, amounts, dates, rates)'}
	aria-label={pricesHidden ? 'Show sensitive data' : 'Hide sensitive data'}
	aria-pressed={pricesHidden}
>
	{#if pricesHidden}
		<EyeOff class="h-4 w-4" />
	{:else}
		<Eye class="h-4 w-4" />
	{/if}
</Button>
