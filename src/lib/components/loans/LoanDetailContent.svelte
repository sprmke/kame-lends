<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import LoanSummarySection from './LoanSummarySection.svelte';
	import LoanInvestorsSection from './LoanInvestorsSection.svelte';
	import LoanPaymentMethodsSection from './LoanPaymentMethodsSection.svelte';
	import { formatDate, formatText, formatSqm } from '$lib/format';
	import { getLoanStatusBadge, getLoanTypeBadge } from '$lib/badge-config';
	import LoanWitnessesSection from './LoanWitnessesSection.svelte';
	import LoanBorrowerProfitCard from './LoanBorrowerProfitCard.svelte';
	import {
		calculateTotalPrincipal,
		calculateTotalInterest,
		calculateTotalAmount,
		calculateAverageRate,
		calculateInterest,
		countUniqueInvestors,
		groupByInvestor,
		calculateLoanDuration
	} from '$lib/calculations';
	import type { LoanWithInvestors, PaymentMethod } from '$lib/types';
	import type { LoanAccessContext } from '$lib/loan-access';
	import { normalizePaymentReceipts } from '$lib/payment-receipts';
	import GroupBadgeList from '$lib/components/groups/GroupBadgeList.svelte';
	import GroupPickerSheet from '$lib/components/groups/GroupPickerSheet.svelte';
	import { SHOW_GROUPS_UI } from '$lib/feature-flags';
	import { badgesForLoan, type GroupsIndexItem } from '$lib/groups/loan-group-filter';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { toast } from '$lib/toast';

	interface Props {
		loan: LoanWithInvestors;
		showHeader?: boolean;
		onRefresh?: () => void | Promise<void>;
		loanId?: number;
		readOnly?: boolean;
		editableInvestorIds?: number[];
		paymentMethods?: PaymentMethod[];
		access?: LoanAccessContext;
	}

	let {
		loan,
		showHeader = true,
		onRefresh,
		loanId,
		readOnly = false,
		editableInvestorIds = [],
		paymentMethods = [],
		access
	}: Props = $props();

	const totalPrincipal = $derived(calculateTotalPrincipal(loan.loanInvestors));
	const totalInterest = $derived(calculateTotalInterest(loan.loanInvestors));
	const totalAmount = $derived(calculateTotalAmount(loan.loanInvestors));
	const averageRate = $derived(calculateAverageRate(loan.loanInvestors));
	const uniqueInvestors = $derived(countUniqueInvestors(loan.loanInvestors));

	const profit = $derived(
		calculateInterest(totalPrincipal, loan.profitValue, loan.profitType)
	);
	const profitRate = $derived(loan.profitType === 'rate' ? Number(loan.profitValue) : 0);

	const canEditBorrowerProfit = $derived(
		access
			? !access.isGroupViewer &&
					(access.canAdminEdit || access.memberships.includes('borrower'))
			: false
	);
	const isGroupViewer = $derived(Boolean(access?.isGroupViewer));
	const effectiveReadOnly = $derived(readOnly || isGroupViewer);
	const myLoanWitnessId = $derived(access?.linkedLoanWitnessId ?? null);

	const groupsIndex = $derived(
		((page.data as { groupsIndex?: GroupsIndexItem[] }).groupsIndex ?? []) as GroupsIndexItem[]
	);
	const groupBadges = $derived(badgesForLoan(loan, groupsIndex));
	const canManageGroups = $derived(SHOW_GROUPS_UI && Boolean(access?.canAdminEdit));
	const viaGroupLabel = $derived.by(() => {
		const ids = access?.viaGroupIds ?? [];
		const match = groupsIndex.find((group) => ids.includes(group.id));
		return match?.name ?? null;
	});
	/* Local picker selection needs $state; badge list sync is not a pure derived. */
	/* eslint-disable svelte/prefer-writable-derived */
	let groupPickerOpen = $state(false);
	let selectedGroupIds = $state<number[]>([]);

	$effect(() => {
		selectedGroupIds = groupBadges.map((g) => g.id);
	});
	/* eslint-enable svelte/prefer-writable-derived */
	async function saveLoanGroups(ids: number[]) {
		const id = loanId ?? loan.id;
		const res = await fetch(`/api/loans/${id}/groups`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ groupIds: ids })
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			toast.error((body as { error?: string }).error ?? 'Failed to update groups');
			return;
		}
		toast.success('Groups updated');
		groupPickerOpen = false;
		await onRefresh?.();
	}

	const totalReceived = $derived(
		loan.loanInvestors.reduce(
			(sum, li) =>
				sum + (li.receivedPayments || []).reduce((t, rp) => t + (parseFloat(rp.amount) || 0), 0),
			0
		)
	);
	const totalBalance = $derived(totalAmount - totalReceived);

	const earliestSentDate = $derived(
		loan.loanInvestors.reduce(
			(earliest, li) => {
				const sentDate = new Date(li.sentDate);
				return !earliest || sentDate < earliest ? sentDate : earliest;
			},
			null as Date | null
		)
	);

	const duration = $derived(calculateLoanDuration(loan.dueDate, earliestSentDate || undefined));

	const fundedCapital = $derived(
		loan.loanInvestors.reduce(
			(sum, li) => (li.isPaid ? sum + (parseFloat(li.amount) || 0) : sum),
			0
		)
	);
	const balance = $derived(totalPrincipal - fundedCapital);

	const investorGroups = $derived(
		Array.from(groupByInvestor(loan.loanInvestors).values()).map((transactions) => {
			const transactionWithPeriods = transactions.find(
				(t) => t.interestPeriods && t.interestPeriods.length > 0
			);

			const receivedPayments = transactions.flatMap((li) =>
				(li.receivedPayments || []).map((rp) => ({
					id: rp.id,
					amount: rp.amount,
					interestPeriodId: rp.interestPeriodId ?? null,
					receipts: normalizePaymentReceipts(rp),
					receivedDate:
						typeof rp.receivedDate === 'string'
							? rp.receivedDate
							: rp.receivedDate instanceof Date
								? rp.receivedDate.toISOString().slice(0, 10)
								: String(rp.receivedDate)
				}))
			);

			return {
				investor: transactions[0].investor,
				transactions: transactions.map((transaction) => ({
					...transaction,
					receipts: normalizePaymentReceipts(transaction)
				})),
				receivedPayments: receivedPayments.length > 0 ? receivedPayments : undefined,
				hasMultipleInterest: transactions[0].hasMultipleInterest || false,
				interestPeriods: transactionWithPeriods?.interestPeriods || []
			};
		})
	);
</script>

<div class="dashboard-stack">
	{#if isGroupViewer}
		<div
			class="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-900 dark:text-sky-100"
		>
			Shared with you through {viaGroupLabel ? formatText(viaGroupLabel) : 'a group'} · Read-only
			{#if access?.viaGroupIds?.[0]}
				·
				<a class="underline underline-offset-2" href={`/groups/${access.viaGroupIds[0]}`}
					>Open group</a
				>
			{/if}
		</div>
	{/if}
	{#if showHeader}
		<div class="space-y-1">
			<h2 class="text-xl font-semibold tracking-tight">{formatText(loan.loanName)}</h2>
		</div>
	{/if}

	{#if SHOW_GROUPS_UI && (groupBadges.length > 0 || canManageGroups)}
		<div class="flex flex-wrap items-center gap-2">
			{#if groupBadges.length > 0}
				<GroupBadgeList
					groups={groupBadges}
					size="md"
					badgeHref={(group) => `/groups/${group.id}`}
				/>
			{:else}
				<span class="text-sm text-muted-foreground">No groups</span>
			{/if}
			{#if canManageGroups}
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="touch-target"
					onclick={() => (groupPickerOpen = true)}
				>
					Manage groups
				</Button>
			{/if}
		</div>
	{/if}

	<LoanSummarySection
		{totalPrincipal}
		{averageRate}
		{totalInterest}
		{totalAmount}
		{totalReceived}
		{totalBalance}
		{uniqueInvestors}
		status={loan.status}
		{balance}
		{profit}
		{profitRate}
		profitType={loan.profitType}
	/>

	{#if canEditBorrowerProfit}
		<LoanBorrowerProfitCard {loan} {onRefresh} />
	{/if}

	<LoanPaymentMethodsSection {paymentMethods} />

	<Card.Root>
		<Card.Header>
			<Card.Title>Loan Details</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-3">
			<div class="grid gap-3 sm:grid-cols-2">
				<div class="space-y-1">
					<p class="text-caption">Borrower</p>
					<p class="text-sm font-medium">{formatText(loan.borrower?.name ?? '-')}</p>
				</div>
				<div class="space-y-1">
					<p class="text-caption">Loan Name</p>
					<p class="text-sm font-medium">{formatText(loan.loanName)}</p>
				</div>
				<div class="space-y-1">
					<p class="text-caption">Type</p>
					<Badge
						variant={getLoanTypeBadge(loan.type).variant}
						class={getLoanTypeBadge(loan.type).className}
					>
						{formatText(loan.type)}
					</Badge>
				</div>
				<div class="space-y-1">
					<p class="text-caption">Due Date</p>
					<p class="text-sm font-medium">{formatDate(loan.dueDate)}</p>
				</div>
				<div class="space-y-1">
					<p class="text-caption">Status</p>
					<Badge
						variant={getLoanStatusBadge(loan.status).variant}
						class={getLoanStatusBadge(loan.status).className}
					>
						{formatText(loan.status)}
					</Badge>
				</div>
				<div class="space-y-1">
					<p class="text-caption">Free Lot (sqm)</p>
					<p class="text-sm font-medium">{loan.freeLotSqm ? formatSqm(loan.freeLotSqm) : '-'}</p>
				</div>
				<div class="space-y-1">
					<p class="text-caption">Duration</p>
					<p class="text-sm font-medium">{formatText(duration)}</p>
				</div>
			</div>
			<div class="space-y-1">
				<p class="text-caption">Notes</p>
				<p class="text-sm font-medium whitespace-pre-wrap">
					{loan.notes ? formatText(loan.notes) : '-'}
				</p>
			</div>
		</Card.Content>
	</Card.Root>

	<LoanInvestorsSection
		investorsWithTransactions={investorGroups}
		loanId={loanId ?? loan.id}
		{onRefresh}
		readOnly={effectiveReadOnly}
		{editableInvestorIds}
	/>

	<LoanWitnessesSection
		loanWitnesses={loan.loanWitnesses ?? []}
		loanId={loanId ?? loan.id}
		{totalPrincipal}
		{onRefresh}
		canAdminEdit={access?.canAdminEdit ?? false}
		{myLoanWitnessId}
	/>
</div>

{#if canManageGroups}
	<GroupPickerSheet
		open={groupPickerOpen}
		onOpenChange={(open) => (groupPickerOpen = open)}
		title="Groups"
		groups={groupsIndex.map((g) => ({
			id: g.id,
			name: g.name,
			color: g.color,
			loanCount: g.loanCount
		}))}
		selectedIds={selectedGroupIds}
		onSelectedIdsChange={(ids) => (selectedGroupIds = ids)}
		usedColorKeys={groupsIndex.map((g) => g.color)}
		skipPreview
		onSave={saveLoanGroups}
		onCreateInlineGroup={async (payload) => {
			const res = await fetch('/api/groups', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name: payload.name,
					color: payload.color,
					loanIds: [],
					createCalendar: true
				})
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error((body as { error?: string }).error ?? 'Failed to create group');
			}
			const created = (await res.json()) as { id: number; name: string; color: string };
			await invalidateAll();
			return { id: created.id, name: created.name, color: created.color };
		}}
	/>
{/if}
