<script lang="ts">
	import { goto } from '$app/navigation';
	import ActivityPanelCard from '$lib/components/common/ActivityPanelCard.svelte';
	import { resolveGroupColor } from '$lib/groups/group-colors';
	import { formatCount, formatText } from '$lib/format';
	import type { GroupsIndexItem } from '$lib/groups/loan-group-filter';
	import { cn } from '$lib/utils';

	interface Props {
		groups: GroupsIndexItem[];
		totalCount: number;
		class?: string;
	}

	let { groups, totalCount, class: className }: Props = $props();
</script>

<ActivityPanelCard
	title="Your groups"
	count={totalCount}
	class={className}
	viewAllHref="/groups"
	viewAllLabel="View all groups"
	onViewAllClick={() => void goto('/groups')}
>
	{#if groups.length === 0}
		<p class="py-2 text-center text-sm text-muted-foreground">No groups</p>
	{:else}
		<div class="dashboard-activity-list">
			{#each groups as group (group.id)}
				{@const palette = resolveGroupColor(group.color)}
				<a href="/groups/{group.id}" class="dashboard-activity-item" data-sveltekit-preload-data="tap">
					<div class="flex min-w-0 items-center gap-2">
						<span class={cn('size-2 shrink-0 rounded-full', palette.dot)} aria-hidden="true"></span>
						<p class="min-w-0 truncate text-sm font-medium">{formatText(group.name)}</p>
					</div>
					{#if group.loanCount != null && group.loanCount > 0}
						<p class="text-xs text-muted-foreground">
							{formatCount(group.loanCount)}
							{group.loanCount === 1 ? 'loan' : 'loans'}
						</p>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</ActivityPanelCard>
