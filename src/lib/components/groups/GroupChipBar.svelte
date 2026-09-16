<script lang="ts">
	import { resolveGroupColor } from '$lib/groups/group-colors';
	import { formatCount, formatText } from '$lib/format';
	import type { GroupChipData, GroupChipSelection } from '$lib/components/groups/types';
	import { cn } from '$lib/utils';

	interface Props {
		groups: GroupChipData[];
		selected: GroupChipSelection;
		onSelect: (value: GroupChipSelection) => void;
		showUngrouped?: boolean;
		ungroupedCount?: number;
		showManageLink?: boolean;
		manageHref?: string;
		stickyOnMobile?: boolean;
		class?: string;
	}

	let {
		groups,
		selected,
		onSelect,
		showUngrouped = false,
		ungroupedCount = 0,
		showManageLink = false,
		manageHref = '/groups',
		stickyOnMobile = true,
		class: className
	}: Props = $props();

	type ChipOption = { id: string; value: GroupChipSelection; label: string; count?: number; color?: string };

	const options = $derived.by((): ChipOption[] => {
		const items: ChipOption[] = [{ id: 'all', value: 'all', label: 'All' }];
		for (const group of groups) {
			items.push({
				id: `group-${group.id}`,
				value: group.id,
				label: group.name,
				count: group.loanCountOnPage,
				color: group.color
			});
		}
		if (showUngrouped) {
			items.push({
				id: 'ungrouped',
				value: 'ungrouped',
				label: 'Ungrouped',
				count: ungroupedCount
			});
		}
		return items;
	});

	let chipRefs = $state<(HTMLButtonElement | null)[]>([]);

	function isSelected(value: GroupChipSelection): boolean {
		return selected === value;
	}

	function focusChip(index: number) {
		const el = chipRefs[index];
		el?.focus();
	}

	function handleKeydown(event: KeyboardEvent, index: number) {
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			event.preventDefault();
			const next = (index + 1) % options.length;
			onSelect(options[next]!.value);
			focusChip(next);
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			event.preventDefault();
			const prev = (index - 1 + options.length) % options.length;
			onSelect(options[prev]!.value);
			focusChip(prev);
		}
	}
</script>

<div
	class={cn(
		'min-w-0 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
		stickyOnMobile && 'sticky top-0 z-20 lg:static lg:z-auto lg:border-b-0 lg:bg-transparent lg:backdrop-blur-none',
		className
	)}
>
	<div
		class="flex min-h-11 items-stretch gap-2 overflow-x-auto px-4 py-2 scrollbar-none lg:min-h-0 lg:px-0 lg:py-0"
		role="radiogroup"
		aria-label="Filter by group"
	>
		{#each options as option, index (option.id)}
			{@const palette = option.color ? resolveGroupColor(option.color) : null}
			<button
				type="button"
				bind:this={chipRefs[index]}
				role="radio"
				aria-checked={isSelected(option.value)}
				class={cn(
					'touch-target inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
					isSelected(option.value)
						? cn('border-primary/40 bg-primary/10 text-foreground', palette?.ring)
						: 'border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/70'
				)}
				onclick={() => onSelect(option.value)}
				onkeydown={(event) => handleKeydown(event, index)}
			>
				{#if palette}
					<span class={cn('size-2 shrink-0 rounded-full', palette.dot)} aria-hidden="true"></span>
				{/if}
				<span class="max-w-[9rem] truncate">{formatText(option.label)}</span>
				{#if option.count != null && option.value !== 'all'}
					<span class="text-xs tabular-nums opacity-80">{formatCount(option.count)}</span>
				{/if}
			</button>
		{/each}

		{#if showManageLink}
			<a
				href={manageHref}
				data-sveltekit-preload-data="tap"
				class="touch-target inline-flex shrink-0 items-center self-center rounded-full px-3 text-sm font-medium text-primary hover:underline"
			>
				Manage groups
			</a>
		{/if}
	</div>
</div>
