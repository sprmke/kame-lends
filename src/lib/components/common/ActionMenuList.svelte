<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import ActionMenuIcon from './ActionMenuIcon.svelte';
	import type { RowActionItem } from './action-buttons';

	interface Props {
		items: RowActionItem[];
	}

	let { items }: Props = $props();
</script>

{#each items as item, index (item.label + index)}
	{#if item.separatorBefore}
		<DropdownMenu.Separator />
	{/if}
	<DropdownMenu.Item
		variant={item.destructive ? 'destructive' : 'default'}
		disabled={item.disabled}
		onclick={item.onClick}
	>
		{#if item.icon}
			<ActionMenuIcon icon={item.icon} />
		{/if}
		{item.label}
	</DropdownMenu.Item>
{/each}
