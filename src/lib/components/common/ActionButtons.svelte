<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import {
		ArrowDownToLine,
		ArrowUpFromLine,
		Copy,
		Eye,
		FileText,
		Maximize2,
		MoreVertical,
		Pencil,
		Trash2
	} from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import type { RowActionItem } from './action-buttons';

	interface Props {
		viewHref: string;
		onQuickView?: (event: MouseEvent) => void;
		actionItems?: RowActionItem[];
		size?: 'sm' | 'md';
		class?: string;
		showView?: boolean;
	}

	let {
		viewHref,
		onQuickView,
		actionItems = [],
		size = 'sm',
		class: className = '',
		showView = true
	}: Props = $props();

	const isCardSize = $derived(size === 'md');
	const tableActionButtonClass = 'h-7 text-xs px-2 gap-1 [&_svg]:size-3';
	const cardActionButtonClass =
		'h-9 min-h-9 w-full flex-1 rounded-none px-4 text-xs font-medium gap-1.5 hover:bg-muted/60 shadow-none [&_svg]:size-3.5 only:rounded-b-3xl first:rounded-bl-3xl last:rounded-br-3xl';
</script>

<div
	class={cn(
		'flex items-stretch',
		isCardSize ? 'w-full' : 'justify-end gap-1 md:gap-1.5',
		className
	)}
	onclick={(event) => event.stopPropagation()}
	onkeydown={(event) => event.stopPropagation()}
	role="presentation"
>
	{#if onQuickView}
		<Button
			variant="ghost"
			size="sm"
			class={cn(
				isCardSize ? cardActionButtonClass : tableActionButtonClass,
				isCardSize && 'flex-1'
			)}
			onclick={onQuickView}
		>
			{#if isCardSize}<Maximize2 />{/if}
			<span>View</span>
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
						variant="ghost"
						size="sm"
						title="More actions"
						class={cn(
							isCardSize ? cardActionButtonClass : tableActionButtonClass,
							isCardSize && 'flex-1'
						)}
					>
						<MoreVertical />
						{#if isCardSize}<span>More</span>{/if}
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				{#each actionItems as item, index (item.label + index)}
					{#if item.separatorBefore}
						<DropdownMenu.Separator />
					{/if}
					<DropdownMenu.Item
						class={item.destructive ? 'text-destructive focus:text-destructive' : ''}
						disabled={item.disabled}
						onclick={item.onClick}
					>
						{#if item.label === 'Fund Transfer'}<ArrowUpFromLine class="h-4 w-4" />
						{:else if item.label === 'Add Received Payment'}<ArrowDownToLine class="h-4 w-4" />
						{:else if item.label === 'Edit'}<Pencil class="h-4 w-4" />
						{:else if item.label === 'Duplicate'}<Copy class="h-4 w-4" />
						{:else if item.label.startsWith('Download') || item.label.startsWith('Generating')}<FileText
								class="h-4 w-4"
							/>
						{:else if item.label === 'Delete'}<Trash2 class="h-4 w-4" />
						{/if}
						{item.label}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{/if}
</div>
