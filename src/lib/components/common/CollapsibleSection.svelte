<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { ChevronDown, Filter } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	interface Props {
		isOpen: boolean;
		onToggle: () => void;
		trigger: {
			label: string;
			icon?: Component;
			showIndicator?: boolean;
		};
		children: Snippet;
	}

	let { isOpen, onToggle, trigger, children }: Props = $props();
	const Icon = $derived(trigger.icon ?? Filter);
</script>

<div class="space-y-2">
	<button
		type="button"
		onclick={onToggle}
		class="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
	>
		<Icon class="h-4 w-4" />
		{trigger.label}
		{#if trigger.showIndicator}
			<span class="h-2 w-2 rounded-full bg-primary"></span>
		{/if}
		<ChevronDown class={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
	</button>
	{#if isOpen}
		<div class="dashboard-filter-panel">
			{@render children()}
		</div>
	{/if}
</div>
