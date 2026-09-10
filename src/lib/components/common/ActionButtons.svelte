<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Eye, Maximize2, MoreVertical } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import ActionMenuList from './ActionMenuList.svelte';
	import type { RowActionItem } from './action-buttons';

	interface Props {
		viewHref: string;
		onQuickView?: (event: MouseEvent) => void;
		actionItems?: RowActionItem[];
		size?: 'sm' | 'md';
		class?: string;
		showView?: boolean;
		/** Card footer primary action label (default View). */
		quickViewLabel?: string;
		/** Show icon on card footer primary action. */
		showQuickViewIcon?: boolean;
		/** Card footer more-menu label; null = icon only. */
		moreLabel?: string | null;
		cardPrimaryVariant?: 'ghost' | 'outline';
	}

	let {
		viewHref,
		onQuickView,
		actionItems = [],
		size = 'sm',
		class: className = '',
		showView = true,
		quickViewLabel = 'View',
		showQuickViewIcon = true,
		moreLabel = 'More',
		cardPrimaryVariant = 'ghost'
	}: Props = $props();

	const isCardSize = $derived(size === 'md');
	const isInlineCardFooter = $derived(isCardSize && cardPrimaryVariant === 'outline');
	const tableActionButtonClass =
		'touch-target h-9 text-xs px-2.5 gap-1 [&_svg]:size-3.5 lg:h-7 lg:px-2 lg:[&_svg]:size-3';
	const cardActionButtonClass =
		'h-9 min-h-9 w-full flex-1 rounded-none px-4 text-xs font-medium gap-1.5 hover:bg-muted/60 shadow-none [&_svg]:size-3.5 only:rounded-b-3xl first:rounded-bl-3xl last:rounded-br-3xl';
	const inlineCardPrimaryClass =
		'min-h-11 flex-1 rounded-full border-border/60 text-xs font-medium shadow-none';
	const inlineCardMoreClass =
		'min-h-11 min-w-11 shrink-0 rounded-full border border-border/60 px-0 shadow-none';
</script>

<div
	class={cn(
		'flex items-stretch',
		isInlineCardFooter ? 'w-full gap-2 p-3' : isCardSize ? 'w-full' : 'justify-end gap-1 md:gap-1.5',
		className
	)}
	onclick={(event) => event.stopPropagation()}
	onkeydown={(event) => event.stopPropagation()}
	role="presentation"
>
	{#if onQuickView}
		<Button
			variant={isCardSize ? cardPrimaryVariant : 'ghost'}
			size="sm"
			class={cn(
				isInlineCardFooter
					? inlineCardPrimaryClass
					: isCardSize
						? cardActionButtonClass
						: tableActionButtonClass,
				isCardSize && !isInlineCardFooter && 'flex-1'
			)}
			onclick={onQuickView}
		>
			{#if isCardSize && showQuickViewIcon}<Maximize2 />{/if}
			<span>{quickViewLabel}</span>
		</Button>
	{/if}

	{#if showView}
		<Button
			variant="ghost"
			size="sm"
			href={viewHref}
			class={cn(
				isCardSize ? cardActionButtonClass : tableActionButtonClass,
				isCardSize && 'flex-1',
				!isCardSize && 'hidden md:inline-flex'
			)}
		>
			{#if isCardSize}<Eye />{/if}
			<span>View</span>
		</Button>
	{/if}

	{#if actionItems.length > 0}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant={isInlineCardFooter ? 'outline' : 'ghost'}
						size="sm"
						title="More actions"
						aria-label="More actions"
						class={cn(
							isInlineCardFooter
								? inlineCardMoreClass
								: isCardSize
									? cardActionButtonClass
									: tableActionButtonClass,
							isCardSize && !isInlineCardFooter && 'flex-1'
						)}
					>
						<MoreVertical />
						{#if isCardSize && moreLabel !== null}<span>{moreLabel}</span>{/if}
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<ActionMenuList items={actionItems} />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{/if}
</div>
