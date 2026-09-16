<script lang="ts">
	import ActionMenuIcon from './ActionMenuIcon.svelte';
	import type { RowActionItem } from './action-buttons';
	import { cn } from '$lib/utils';

	interface Props {
		items: RowActionItem[];
		onSelect?: () => void;
	}

	let { items, onSelect }: Props = $props();

	function handleClick(item: RowActionItem) {
		if (item.disabled) return;
		item.onClick();
		onSelect?.();
	}
</script>

{#each items as item, index (item.label + index)}
	{#if item.separatorBefore}
		<div class="my-1 border-t border-border/50" role="separator"></div>
	{/if}
	<button
		type="button"
		class={cn(
			'native-press flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium transition-colors',
			item.destructive
				? 'text-destructive hover:bg-destructive/5'
				: 'text-foreground hover:bg-accent',
			item.disabled && 'pointer-events-none opacity-50'
		)}
		disabled={item.disabled}
		onclick={() => handleClick(item)}
	>
		{#if item.icon}
			<ActionMenuIcon icon={item.icon} class="size-4 shrink-0" />
		{:else if item.lucideIcon}
			<item.lucideIcon class="size-4 shrink-0" strokeWidth={1.75} />
		{/if}
		<span class="min-w-0 truncate">{item.label}</span>
	</button>
{/each}
