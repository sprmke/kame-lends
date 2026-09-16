<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Sheet from '$lib/components/ui/sheet';
	import { createIsMobileShell } from '$lib/composables/use-media-query.svelte';
	import ActionMenuList from './ActionMenuList.svelte';
	import ActionSheetList from './ActionSheetList.svelte';
	import type { RowActionItem } from './action-buttons';

	interface Props {
		items: RowActionItem[];
		ariaLabel: string;
		sheetTitle?: string;
		contentClass?: string;
		trigger: Snippet<[{ props: Record<string, unknown> }]>;
	}

	let { items, ariaLabel, sheetTitle, contentClass = '', trigger }: Props = $props();

	let sheetOpen = $state(false);
	const mobileShell = createIsMobileShell(false);

	$effect(() => mobileShell.init());

	const visibleItems = $derived(items.filter((item) => !item.disabled));
	const title = $derived(sheetTitle ?? ariaLabel);

	function openSheet(event: MouseEvent) {
		event.stopPropagation();
		sheetOpen = true;
	}
</script>

{#if visibleItems.length > 0}
	{#if mobileShell.matches}
		{@render trigger({
			props: {
				onclick: openSheet,
				'aria-haspopup': 'dialog',
				'aria-expanded': sheetOpen,
				'aria-label': ariaLabel
			}
		})}

		<Sheet.Root open={sheetOpen} onOpenChange={(open) => (sheetOpen = open)}>
			<Sheet.Content side="bottom" showCloseButton={false} class="gap-0 overflow-hidden p-0 pb-0!">
				<Sheet.Header class="border-b border-border/60 px-4 py-3">
					<Sheet.Title class="text-sm font-semibold">{title}</Sheet.Title>
				</Sheet.Header>

				<div
					class="flex flex-col gap-0.5 px-2 py-2 pb-[max(0.5rem,var(--safe-area-bottom))]"
					role="menu"
					aria-label={title}
				>
					<ActionSheetList items={items} onSelect={() => (sheetOpen = false)} />
				</div>
			</Sheet.Content>
		</Sheet.Root>
	{:else}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					{@render trigger({ props })}
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class={contentClass}>
				<ActionMenuList {items} />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{/if}
{/if}
