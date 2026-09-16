<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import ConfirmDeleteDialog from '$lib/components/common/ConfirmDeleteDialog.svelte';
	import GroupHubHeader from '$lib/components/groups/GroupHubHeader.svelte';
	import GroupPeopleTab from '$lib/components/groups/GroupPeopleTab.svelte';
	import GroupSettingsTab from '$lib/components/groups/GroupSettingsTab.svelte';
	import GroupCalendarSettingsCard from '$lib/components/groups/GroupCalendarSettingsCard.svelte';
	import GroupTelegramSettingsCard from '$lib/components/groups/GroupTelegramSettingsCard.svelte';
	import AddGroupLoansSheet from '$lib/components/groups/AddGroupLoansSheet.svelte';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import type { WizardContactOption } from '$lib/components/groups/types';
	import LoanListSummaryCards from '$lib/components/loans/LoanListSummaryCards.svelte';
	import LoanListPage from '$lib/components/loans/LoanListPage.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Tabs from '$lib/components/ui/tabs';
	import { buildGroupPeopleRows } from '$lib/groups/group-people';
	import type { GroupGeneralDraft, GroupRuleRow } from '$lib/components/groups/types';
	import type { GroupColorKey } from '$lib/groups/group-colors';
	import { computeLoanListSummaryStats } from '$lib/loan-list-summary';
	import { isOpenLoan } from '$lib/calculations';
	import { isOverdueLoanForDashboard } from '$lib/loan-due-date';
	import { formatCount, formatDate } from '$lib/format';
	import { groupChannelStatusLabel } from '$lib/groups/channel-status';
	import type { PartyRole } from '$lib/group-membership-diff';
	import { toast } from '$lib/toast';
	import { cn } from '$lib/utils';
	import type { LoanWithInvestors } from '$lib/types';

	let { data } = $props();

	type HubTab = 'overview' | 'loans' | 'people' | 'settings';

	let showDeleteDialog = $state(false);
	let showAddLoans = $state(false);
	let showAddRule = $state(false);
	let rulePartyType = $state<'investor' | 'borrower'>('investor');
	let ruleContactKey = $state('');
	let ruleApplyExisting = $state(true);
	let isSavingRule = $state(false);
	let isSavingGeneral = $state(false);
	let generalEdit = $state<Partial<GroupGeneralDraft>>({});
	const general = $derived({
		name: generalEdit.name ?? data.group.name,
		color: (generalEdit.color ?? data.group.color ?? 'orange') as GroupColorKey,
		description: generalEdit.description ?? data.group.notes ?? ''
	});

	const activeTab = $derived.by(() => {
		const tab = page.url.searchParams.get('tab');
		if (tab === 'settings' && !data.canManage) return 'overview';
		if (tab === 'loans' || tab === 'people' || tab === 'settings') return tab;
		return 'overview';
	});

	const visibleTabs = $derived(
		data.canManage
			? (['overview', 'loans', 'people', 'settings'] as HubTab[])
			: (['overview', 'loans', 'people'] as HubTab[])
	);

	const tabLabels: Record<HubTab, string> = {
		overview: 'Overview',
		loans: 'Loans',
		people: 'People',
		settings: 'Settings'
	};

	function setTab(tab: HubTab) {
		const url = new URL(page.url);
		url.searchParams.set('tab', tab);
		void goto(`${url.pathname}${url.search}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	const people = $derived(
		buildGroupPeopleRows(data.group.members, data.loans, data.group.creatorUserId, {
			includeEmail: data.canManage
		})
	);

	const peopleCount = $derived(people.length);

	const nextDueDate = $derived.by(() => {
		const open = data.loans.filter((loan) => isOpenLoan(loan as LoanWithInvestors));
		if (open.length === 0) return null;
		const sorted = [...open].sort((a, b) =>
			String(a.dueDate).localeCompare(String(b.dueDate))
		);
		return sorted[0]?.dueDate ?? null;
	});

	const summaryStats = $derived(
		computeLoanListSummaryStats(data.loans as LoanWithInvestors[], null, null)
	);

	const overdueCount = $derived(
		data.loans.filter((loan) => isOverdueLoanForDashboard(loan as LoanWithInvestors)).length
	);

	const rules = $derived(
		(data.group.rules ?? []).map(
			(rule): GroupRuleRow => ({
				id: rule.id,
				partyType: rule.partyType,
				contactName:
					(rule as { contactName?: string }).contactName ??
					`Contact ${rule.contactId}`
			})
		)
	);

	const calendarStatusLabel = $derived(
		groupChannelStatusLabel('calendar', data.group.calendar?.status)
	);
	const telegramStatusLabel = $derived(
		groupChannelStatusLabel('telegram', data.group.telegram?.status)
	);

	const upcomingLoans = $derived(
		[...data.loans]
			.filter((loan) => isOpenLoan(loan as LoanWithInvestors))
			.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
			.slice(0, 5)
	);

	async function refresh() {
		await invalidate('app:groups');
	}

	async function handleDelete() {
		const response = await fetch(`/api/groups/${data.group.id}`, { method: 'DELETE' });
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			toast.error(errorData.error || 'Failed to delete group');
			throw new Error(errorData.error || 'Failed to delete group');
		}
		toast.success('Group deleted');
		await goto('/groups');
	}

	async function saveGeneral() {
		isSavingGeneral = true;
		try {
			const response = await fetch(`/api/groups/${data.group.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: general.name.trim(),
					color: general.color,
					description: general.description.trim() || null
				})
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Save failed');
			}
			toast.success('Saved');
			await refresh();
			generalEdit = {};
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Save failed');
		} finally {
			isSavingGeneral = false;
		}
	}

	async function removeRule(ruleId: number) {
		const response = await fetch(`/api/groups/${data.group.id}/rules/${ruleId}`, {
			method: 'DELETE'
		});
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			toast.error(errorData.error || 'Failed to remove rule');
			return;
		}
		toast.success('Rule removed');
		await refresh();
	}

	const ruleContactsForType = $derived(
		((data.ruleContacts ?? []) as WizardContactOption[]).filter(
			(option) => option.partyType === rulePartyType
		)
	);

	$effect(() => {
		if (!showAddRule) return;
		const first = ruleContactsForType[0];
		ruleContactKey = first ? `${first.partyType}:${first.contactId}` : '';
	});

	async function saveRule() {
		const [partyType, contactIdRaw] = ruleContactKey.split(':');
		const contactId = Number(contactIdRaw);
		if (
			(partyType !== 'investor' && partyType !== 'borrower') ||
			!Number.isFinite(contactId)
		) {
			toast.error('Pick a contact');
			return;
		}
		isSavingRule = true;
		try {
			const response = await fetch(`/api/groups/${data.group.id}/rules`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					partyType,
					contactId,
					applyToExisting: ruleApplyExisting
				})
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to add rule');
			}
			toast.success('Rule added');
			showAddRule = false;
			await refresh();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to add rule');
		} finally {
			isSavingRule = false;
		}
	}

	const deleteDescription = $derived(
		`${formatCount(peopleCount)} ${peopleCount === 1 ? 'person' : 'people'} lose access. The shared Google Calendar is deleted. The Telegram chat stops getting updates. Loans are not deleted.`
	);
</script>

<svelte:head><title>{data.group.name}</title></svelte:head>

<DashboardPage>
	<GroupHubHeader
		name={data.group.name}
		color={data.group.color ?? 'orange'}
		description={data.group.notes}
		loanCount={data.loans.length}
		{peopleCount}
		{nextDueDate}
		isOwner={data.canManage}
		viewerRoles={data.viewerRoles as PartyRole[]}
		onBack={() => goto('/groups')}
		onAddLoans={data.canManage ? () => (showAddLoans = true) : undefined}
		onOpenSettings={data.canManage ? () => setTab('settings') : undefined}
		onDelete={data.canManage ? () => (showDeleteDialog = true) : undefined}
	/>

	<Tabs.Root value={activeTab} onValueChange={(value) => setTab(value as HubTab)}>
		<Tabs.List
			class={cn(
				'mb-4 grid h-auto w-full gap-1 overflow-hidden p-1',
				data.canManage ? 'grid-cols-4' : 'grid-cols-3'
			)}
		>
			{#each visibleTabs as tab (tab)}
				<Tabs.Trigger value={tab} class="flex-none px-2">{tabLabels[tab]}</Tabs.Trigger>
			{/each}
		</Tabs.List>

		<Tabs.Content value="overview" class="space-y-4">
			{#if overdueCount > 0}
				<Card.Root class="border-destructive/40">
					<Card.Header class="pb-2">
						<Card.Title class="text-base text-destructive">Needs attention</Card.Title>
					</Card.Header>
					<Card.Content class="text-sm text-muted-foreground">
						{formatCount(overdueCount)} overdue
						{overdueCount === 1 ? 'loan' : 'loans'}.
						<button
							type="button"
							class="ml-1 font-medium text-primary hover:underline"
							onclick={() => setTab('loans')}
						>
							View loans
						</button>
					</Card.Content>
				</Card.Root>
			{/if}

			{#if data.loans.length > 0}
				<LoanListSummaryCards stats={summaryStats} />
			{:else}
				<Card.Root>
					<Card.Content class="flex flex-col items-start gap-3 p-6">
						<p class="text-sm text-muted-foreground">No loans in this group yet.</p>
						{#if data.canManage}
							<Button type="button" onclick={() => (showAddLoans = true)}>Add loans</Button>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}

			<div class="grid gap-4 sm:grid-cols-2">
				<Card.Root>
					<Card.Header class="pb-2">
						<Card.Title class="text-base">Group</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-2 text-sm">
						<button
							type="button"
							class="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left hover:bg-muted/40"
							onclick={() => setTab('loans')}
						>
							<span class="text-muted-foreground">Loans</span>
							<span class="font-medium tabular-nums">{formatCount(data.loans.length)}</span>
						</button>
						<button
							type="button"
							class="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left hover:bg-muted/40"
							onclick={() => setTab('people')}
						>
							<span class="text-muted-foreground">People</span>
							<span class="font-medium tabular-nums">{formatCount(peopleCount)}</span>
						</button>
						<div class="flex items-center justify-between px-1 py-1.5">
							<span class="text-muted-foreground">Next due</span>
							<span class="font-medium">
								{nextDueDate ? formatDate(nextDueDate) : 'None'}
							</span>
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header class="pb-2">
						<Card.Title class="text-base">Channels</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-2 text-sm">
						<button
							type="button"
							class="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-muted/40"
							onclick={() => {
								if (data.canManage) setTab('settings');
							}}
						>
							<span class="text-muted-foreground">Calendar</span>
							<span class="truncate font-medium">{calendarStatusLabel}</span>
						</button>
						<button
							type="button"
							class="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-muted/40"
							onclick={() => {
								if (data.canManage) setTab('settings');
							}}
						>
							<span class="text-muted-foreground">Telegram</span>
							<span class="truncate font-medium">{telegramStatusLabel}</span>
						</button>
					</Card.Content>
				</Card.Root>
			</div>

			{#if upcomingLoans.length > 0}
				<Card.Root>
					<Card.Header class="flex flex-row items-center justify-between gap-2 pb-2">
						<Card.Title class="text-base">Upcoming</Card.Title>
						<button
							type="button"
							class="text-sm font-medium text-primary hover:underline"
							onclick={() => setTab('loans')}
						>
							All loans
						</button>
					</Card.Header>
					<Card.Content class="space-y-1">
						{#each upcomingLoans as loan (loan.id)}
							<button
								type="button"
								class="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/40"
								onclick={() => goto(`/loans/${loan.id}`)}
							>
								<span class="min-w-0 truncate text-sm font-medium">{loan.loanName}</span>
								<span class="shrink-0 text-xs text-muted-foreground">
									{formatDate(loan.dueDate)}
								</span>
							</button>
						{/each}
					</Card.Content>
				</Card.Root>
			{/if}
		</Tabs.Content>

		<Tabs.Content value="loans" class="text-base">
			<LoanListPage {data} scope="group" groupContext={{ groupId: data.group.id }} />
		</Tabs.Content>

		<Tabs.Content value="people">
			<GroupPeopleTab people={people} loans={data.loans as LoanWithInvestors[]} />
		</Tabs.Content>

		{#if data.canManage}
			<Tabs.Content value="settings">
				<GroupSettingsTab
					{general}
					onGeneralChange={(draft) => (generalEdit = draft)}
					onSaveGeneral={saveGeneral}
					{isSavingGeneral}
					{rules}
					canManageRules={true}
					onAddRule={() => (showAddRule = true)}
					onRemoveRule={removeRule}
				>
					{#snippet calendarCard()}
						<GroupCalendarSettingsCard
							groupId={data.group.id}
							status={data.group.calendar?.status}
							googleCalendarId={data.group.calendar?.googleCalendarId}
							lastError={data.group.calendar?.lastError}
							subscribeUrl={data.calendarSubscribeUrl}
							onSynced={refresh}
						/>
					{/snippet}
					{#snippet telegramCard()}
						<GroupTelegramSettingsCard
							groupId={data.group.id}
							startGroupAvailable={data.telegramStartGroupAvailable}
							initial={data.group.telegram}
							onChanged={refresh}
						/>
					{/snippet}
					{#snippet dangerZone()}
						<Card.Root class="border-destructive/40">
							<Card.Header>
								<Card.Title class="text-base text-destructive">Delete group</Card.Title>
							</Card.Header>
							<Card.Content class="space-y-3">
								<p class="text-sm text-muted-foreground">{deleteDescription}</p>
								<Button variant="destructive" onclick={() => (showDeleteDialog = true)}>
									Delete group
								</Button>
							</Card.Content>
						</Card.Root>
					{/snippet}
				</GroupSettingsTab>
			</Tabs.Content>
		{/if}
	</Tabs.Root>
</DashboardPage>

<ConfirmDeleteDialog
	open={showDeleteDialog}
	onOpenChange={(open) => (showDeleteDialog = open)}
	title="Delete group?"
	description={deleteDescription}
	onConfirm={handleDelete}
/>

{#if data.canManage}
	<AddGroupLoansSheet
		open={showAddLoans}
		onOpenChange={(open) => (showAddLoans = open)}
		groupId={data.group.id}
		availableLoans={data.addableLoans ?? []}
		onAdded={refresh}
	/>

	<ResponsiveModal
		open={showAddRule}
		onOpenChange={(open) => (showAddRule = open)}
		title="Add rule"
		contentClass="sm:max-w-md"
	>
		<div class="space-y-4">
			<div class="space-y-2">
				<span class="text-sm font-medium">Contact type</span>
				<div class="flex gap-2">
					<Button
						type="button"
						size="sm"
						variant={rulePartyType === 'investor' ? 'default' : 'outline'}
						onclick={() => (rulePartyType = 'investor')}
					>
						Investor
					</Button>
					<Button
						type="button"
						size="sm"
						variant={rulePartyType === 'borrower' ? 'default' : 'outline'}
						onclick={() => (rulePartyType = 'borrower')}
					>
						Borrower
					</Button>
				</div>
			</div>
			{#if ruleContactsForType.length === 0}
				<p class="text-sm text-muted-foreground">No {rulePartyType}s with loans yet.</p>
			{:else}
				<div class="space-y-2">
					<Label for="rule-contact">Contact</Label>
					<select
						id="rule-contact"
						class="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
						bind:value={ruleContactKey}
					>
						{#each ruleContactsForType as option (option.contactId)}
							<option value="{option.partyType}:{option.contactId}">{option.name}</option>
						{/each}
					</select>
				</div>
				<label class="flex min-h-11 items-center gap-2 text-sm">
					<Checkbox bind:checked={ruleApplyExisting} />
					Also add their existing loans
				</label>
			{/if}
		</div>
		{#snippet footer()}
			<Button
				type="button"
				variant="outline"
				class="touch-target h-12 w-full"
				disabled={isSavingRule}
				onclick={() => (showAddRule = false)}
			>
				Cancel
			</Button>
			<Button
				type="button"
				class="touch-target h-12 w-full"
				disabled={isSavingRule || ruleContactsForType.length === 0 || !ruleContactKey}
				onclick={() => void saveRule()}
			>
				{isSavingRule ? 'Adding…' : 'Add rule'}
			</Button>
		{/snippet}
	</ResponsiveModal>
{/if}
