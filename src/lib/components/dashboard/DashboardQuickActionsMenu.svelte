<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import ResponsiveOverflowMenu from '$lib/components/common/ResponsiveOverflowMenu.svelte';
	import type { RowActionItem } from '$lib/components/common/action-buttons';
	import {
		buildDashboardQuickActions,
		type DashboardQuickAction
	} from '$lib/dashboard-quick-actions';
	import { ChevronDown, PlusCircle } from 'lucide-svelte';

	const actions = $derived(buildDashboardQuickActions());

	const menuItems = $derived<RowActionItem[]>(
		actions.map((action) => ({
			label: action.label,
			lucideIcon: action.icon,
			onClick: () => handleSelect(action)
		}))
	);

	function handleSelect(action: DashboardQuickAction) {
		void goto(action.href);
	}
</script>

{#if actions.length > 0}
	<ResponsiveOverflowMenu items={menuItems} ariaLabel="Create new" sheetTitle="New">
		{#snippet trigger({ props })}
			<Button size="sm" {...props} adaptToMobileHero aria-label="Create new">
				<PlusCircle class="h-4 w-4 lg:mr-1.5" />
				<span class="hidden lg:inline">New</span>
				<ChevronDown class="h-4 w-4 opacity-70" />
			</Button>
		{/snippet}
	</ResponsiveOverflowMenu>
{/if}
