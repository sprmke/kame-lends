<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import {
		buildDashboardQuickActions,
		type DashboardQuickAction
	} from '$lib/dashboard-quick-actions';
	import { ChevronDown, PlusCircle } from 'lucide-svelte';

	const actions = $derived(buildDashboardQuickActions());

	function handleSelect(action: DashboardQuickAction) {
		void goto(action.href);
	}
</script>

{#if actions.length > 0}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button size="sm" {...props} adaptToMobileHero aria-label="Create new">
					<PlusCircle class="h-4 w-4 lg:mr-1.5" />
					<span class="hidden lg:inline">New</span>
					<ChevronDown class="h-4 w-4 opacity-70" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="min-w-44">
			{#each actions as action (action.id)}
				<DropdownMenu.Item onclick={() => handleSelect(action)}>
					<action.icon class="h-4 w-4" />
					{action.label}
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}
