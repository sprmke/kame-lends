<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ListPageToolbar from '$lib/components/common/ListPageToolbar.svelte';
	import ListEmptyState from '$lib/components/common/ListEmptyState.svelte';
	import GroupCard from '$lib/components/groups/GroupCard.svelte';
	import GroupFormModal from '$lib/components/groups/GroupFormModal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { PlusCircle, Folders, X } from 'lucide-svelte';
	import type { LoanGroupWithDetails } from '$lib/types';

	let { data } = $props();

	let items = $state<LoanGroupWithDetails[] | null>(null);

	$effect(() => {
		let active = true;
		data.items.then((value: LoanGroupWithDetails[]) => {
			if (active) items = value;
		});
		return () => {
			active = false;
		};
	});

	let searchQuery = $state('');
	let showFormModal = $state(false);

	async function refreshGroups() {
		await invalidate('app:groups');
		items = (await data.items) as LoanGroupWithDetails[];
	}

	function handleQuickView(group: LoanGroupWithDetails) {
		goto(`/groups/${group.id}`);
	}

	const hasActiveFilters = $derived(searchQuery !== '');

	function clearFilters() {
		searchQuery = '';
	}

	const filteredGroups = $derived(
		(items ?? []).filter((group) => {
			if (!searchQuery) return true;
			return group.name.toLowerCase().includes(searchQuery.toLowerCase());
		})
	);
</script>

<svelte:head><title>Groups</title></svelte:head>

<DashboardPage>
	<PageHeader title="Groups" description="Organize loans into shared groups">
		<Button size="sm" adaptToMobileHero aria-label="New Group" onclick={() => (showFormModal = true)}>
			<PlusCircle class="h-4 w-4 lg:mr-2" />
			<span class="hidden lg:inline">New Group</span>
		</Button>
	</PageHeader>

	{#if items === null}
		<p class="text-sm text-muted-foreground">Loading groups...</p>
	{:else}
		<ListPageToolbar
			searchValue={searchQuery}
			searchPlaceholder="Search groups..."
			onSearchChange={(value) => (searchQuery = value)}
			hasData={items.length > 0}
			showViewToggle={false}
			{hasActiveFilters}
			onClearFilters={clearFilters}
		/>

		{#if filteredGroups.length === 0}
			<ListEmptyState
				message={(items?.length ?? 0) === 0
					? 'No groups yet. Create one to organize your loans.'
					: 'No groups match your search.'}
				icon={Folders}
			>
				{#if hasActiveFilters}
					{#snippet actions()}
						<Button variant="outline" onclick={clearFilters}>
							<X class="mr-2 h-4 w-4" />
							Clear filters
						</Button>
					{/snippet}
				{/if}
			</ListEmptyState>
		{:else}
			<div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
				{#each filteredGroups as group (group.id)}
					<GroupCard {group} currentUserId={data.currentUserId} onQuickView={handleQuickView} />
				{/each}
			</div>
		{/if}
	{/if}
</DashboardPage>

<GroupFormModal
	open={showFormModal}
	onOpenChange={(open) => (showFormModal = open)}
	onSuccess={async () => {
		await refreshGroups();
	}}
/>
