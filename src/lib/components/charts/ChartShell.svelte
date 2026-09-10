<script lang="ts">
	import './chart.css';
	import type { Snippet } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { cn } from '$lib/utils';

	interface Props {
		title: string;
		action?: Snippet;
		children: Snippet;
		class?: string;
	}

	let { title, action, children, class: className }: Props = $props();
</script>

<Card.Root class={cn('surface-card overflow-visible border-border/60', className)}>
	<Card.Header class="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
		<Card.Title class="text-sm font-medium">{title}</Card.Title>
		{#if action}
			{@render action()}
		{/if}
	</Card.Header>
	<Card.Content class="min-w-0">
		{@render children()}
	</Card.Content>
</Card.Root>
