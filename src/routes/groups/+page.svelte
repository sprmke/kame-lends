<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ListPageToolbar from '$lib/components/common/ListPageToolbar.svelte';
	import ListEmptyState from '$lib/components/common/ListEmptyState.svelte';
	import ListPageSkeleton from '$lib/components/common/ListPageSkeleton.svelte';
	import GroupCard from '$lib/components/groups/GroupCard.svelte';
	import CreateGroupWizard from '$lib/components/groups/CreateGroupWizard.svelte';
	import type { GroupListCardData, WizardContactOption } from '$lib/components/groups/types';
	import type { GroupListCardWithMeta } from '$lib/groups/group-list-map';
	import { PAGE_DESCRIPTIONS } from '$lib/page-descriptions';
	import { Button } from '$lib/components/ui/button';
	import { Folders, PlusCircle, UsersRound, X } from 'lucide-svelte';

	let { data } = $props();

	type SortMode = 'attention' | 'name' | 'updated';

	type WizardPayload = {
		ownedLoans: import('$lib/components/groups/types').WizardLoanRow[];
		usedColorKeys: string[];
		existingNames: string[];
		contactOptions: WizardContactOption[];
	};

	let items = $state<GroupListCardWithMeta[] | null>(null);
	let wizardData = $state<WizardPayload | null>(null);
	let wizardLoading = $state(false);

	let searchQuery = $state('');
	let sortMode = $state<SortMode>('attention');
	let showWizard = $state(false);
	let wizardContact = $state<WizardContactOption | null>(null);
	let wizardLoanIds = $state<number[]>([]);

	$effect(() => {
		let active = true;
		void data.items.then((value) => {
			if (active) items = value;
		});
		return () => {
			active = false;
		};
	});

	$effect(() => {
		if (page.url.searchParams.get('create') !== '1') return;
		const params = page.url.searchParams;
		const loanIdsRaw = params.get('loanIds');
		wizardLoanIds = loanIdsRaw
			? loanIdsRaw
					.split(',')
					.map((value) => Number(value.trim()))
					.filter((id) => Number.isFinite(id) && id > 0)
			: [];
		const investorId = Number(params.get('investorId'));
		const borrowerId = Number(params.get('borrowerId'));
		if (Number.isFinite(investorId) && investorId > 0) {
			wizardContact = {
				partyType: 'investor',
				contactId: investorId,
				name: params.get('name')?.trim() || 'Investor',
				loanIds: wizardLoanIds
			};
		} else if (Number.isFinite(borrowerId) && borrowerId > 0) {
			wizardContact = {
				partyType: 'borrower',
				contactId: borrowerId,
				name: params.get('name')?.trim() || 'Borrower',
				loanIds: wizardLoanIds
			};
		} else {
			wizardContact = null;
		}
		showWizard = true;
		void ensureWizardData();
		const url = new URL(page.url);
		url.searchParams.delete('create');
		url.searchParams.delete('loanIds');
		url.searchParams.delete('investorId');
		url.searchParams.delete('borrowerId');
		url.searchParams.delete('name');
		const next = `${url.pathname}${url.search}${url.hash}`;
		void goto(next, { replaceState: true, keepFocus: true, noScroll: true });
	});

	const hasActiveFilters = $derived(searchQuery !== '');

	function clearFilters() {
		searchQuery = '';
	}

	async function ensureWizardData() {
		if (wizardData !== null || wizardLoading) return;
		wizardLoading = true;
		try {
			const response = await fetch('/api/groups/wizard-data');
			if (!response.ok) throw new Error('Failed to load wizard data');
			wizardData = (await response.json()) as WizardPayload;
		} finally {
			wizardLoading = false;
		}
	}

	function openWizard() {
		wizardContact = null;
		wizardLoanIds = [];
		showWizard = true;
		void ensureWizardData();
	}

	async function refreshGroups() {
		wizardData = null;
		await invalidate('app:groups');
	}

	function handleOpenGroup(group: GroupListCardData) {
		goto(`/groups/${group.id}?tab=overview`);
	}

	function compareGroups(a: GroupListCardWithMeta, b: GroupListCardWithMeta): number {
		if (sortMode === 'name') {
			return a.name.localeCompare(b.name);
		}
		if (sortMode === 'updated') {
			return b.updatedAt.localeCompare(a.updatedAt);
		}
		const overdueDiff = (b.overdueCount ?? 0) - (a.overdueCount ?? 0);
		if (overdueDiff !== 0) return overdueDiff;
		if (a.nextDueDate && b.nextDueDate) {
			return String(a.nextDueDate).localeCompare(String(b.nextDueDate));
		}
		if (a.nextDueDate) return -1;
		if (b.nextDueDate) return 1;
		return a.name.localeCompare(b.name);
	}

	function matchesSearch(group: GroupListCardWithMeta): boolean {
		if (!searchQuery) return true;
		return group.name.toLowerCase().includes(searchQuery.toLowerCase());
	}

	const ownedGroups = $derived(
		(items ?? []).filter((group) => group.isViewerOwner).filter(matchesSearch).sort(compareGroups)
	);
	const sharedGroups = $derived(
		(items ?? [])
			.filter((group) => !group.isViewerOwner)
			.filter(matchesSearch)
			.sort(compareGroups)
	);

	const showSearch = $derived((items?.length ?? 0) > 6);
	const ownedLoans = $derived(wizardData?.ownedLoans ?? []);
	const usedColorKeys = $derived(wizardData?.usedColorKeys ?? []);
	const existingNames = $derived(wizardData?.existingNames ?? []);
	const contactOptions = $derived(wizardData?.contactOptions ?? []);
</script>

<svelte:head><title>Groups</title></svelte:head>

<DashboardPage>
	<PageHeader title="Groups" description={PAGE_DESCRIPTIONS.groups}>
		{#if data.canCreate}
			<Button
				size="sm"
				adaptToMobileHero
				aria-label="New group"
				onclick={openWizard}
			>
				<PlusCircle class="h-4 w-4 lg:mr-2" />
				<span class="hidden lg:inline">New group</span>
			</Button>
		{/if}
	</PageHeader>

	{#if items === null}
		<ListPageSkeleton variant="groups" />
	{:else}
		{#if showSearch || hasActiveFilters}
			<div class="mb-4 space-y-3">
				{#if showSearch}
					<ListPageToolbar
						searchValue={searchQuery}
						searchPlaceholder="Search groups"
						onSearchChange={(value) => (searchQuery = value)}
						hasData={items.length > 0}
						showViewToggle={false}
						{hasActiveFilters}
						onClearFilters={clearFilters}
					/>
				{/if}
				<div class="flex items-center gap-2">
					<label for="group-sort" class="text-sm text-muted-foreground">Sort</label>
					<select
						id="group-sort"
						class="h-9 rounded-md border border-input bg-background px-2 text-sm"
						bind:value={sortMode}
					>
						<option value="attention">Needs attention</option>
						<option value="name">Name</option>
						<option value="updated">Recently updated</option>
					</select>
				</div>
			</div>
		{/if}

		{#if hasActiveFilters && ownedGroups.length === 0 && sharedGroups.length === 0}
			<ListEmptyState message="No groups match your search." icon={Folders}>
				{#snippet actions()}
					<Button variant="outline" onclick={clearFilters}>
						<X class="mr-2 h-4 w-4" />
						Clear filters
					</Button>
				{/snippet}
			</ListEmptyState>
		{:else}
			<div class="dashboard-stack">
				<section class="dashboard-section">
					<div class="dashboard-section-header">
						<h2 class="dashboard-section-title">Your groups</h2>
					</div>
					{#if ownedGroups.length === 0}
						{#if data.canCreate}
							<ListEmptyState message="No groups yet." icon={Folders}>
								{#snippet actions()}
									<Button onclick={openWizard}>New group</Button>
								{/snippet}
							</ListEmptyState>
						{:else}
							<ListEmptyState message="No groups yet." icon={Folders} />
						{/if}
					{:else}
						<div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
							{#each ownedGroups as group (group.id)}
								<GroupCard group={group} onOpen={() => handleOpenGroup(group)} />
							{/each}
						</div>
					{/if}
				</section>

				<section class="dashboard-section">
					<div class="dashboard-section-header">
						<h2 class="dashboard-section-title">Shared with you</h2>
					</div>
					{#if sharedGroups.length === 0}
						<ListEmptyState message="No shared groups." icon={UsersRound} />
					{:else}
						<div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
							{#each sharedGroups as group (group.id)}
								<GroupCard group={group} onOpen={() => handleOpenGroup(group)} />
							{/each}
						</div>
					{/if}
				</section>
			</div>
		{/if}
	{/if}
</DashboardPage>

{#if data.canCreate}
	<CreateGroupWizard
		open={showWizard}
		onOpenChange={(open) => {
			showWizard = open;
			if (!open) {
				wizardContact = null;
				wizardLoanIds = [];
			}
		}}
		{ownedLoans}
		{usedColorKeys}
		{existingNames}
		initialLoanIds={wizardLoanIds}
		initialContact={wizardContact}
		{contactOptions}
		contactsReady={wizardData !== null && !wizardLoading}
		createCalendarAvailable={data.createCalendarAvailable}
		telegramStartGroupAvailable={data.telegramStartGroupAvailable}
		telegramBotConfigured={data.telegramBotConfigured}
		onCreated={async (groupId) => {
			await refreshGroups();
			await goto(`/groups/${groupId}?tab=overview`);
		}}
	/>
{/if}
