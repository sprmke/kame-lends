<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChevronDown, Filter } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import type { IconComponent } from '$lib/types/icon';
	import MoreFiltersSurface from '$lib/components/common/MoreFiltersSurface.svelte';

	interface Props {
		isOpen: boolean;
		onToggle: () => void;
		trigger: {
			label: string;
			icon?: IconComponent;
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
		class="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
	>
		<Icon class="h-4 w-4" />
		{trigger.label}
		{#if trigger.showIndicator}
			<span class="h-2 w-2 rounded-full bg-primary"></span>
		{/if}
		<ChevronDown class={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
	</button>
	<MoreFiltersSurface
		open={isOpen}
		onOpenChange={(next) => {
			if (next !== isOpen) onToggle();
		}}
	>
		{#snippet children()}
			{@render children()}
		{/snippet}
	</MoreFiltersSurface>
</div>
