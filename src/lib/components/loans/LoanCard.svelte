<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import ActionButtons from '$lib/components/common/ActionButtons.svelte';
	import {
		createCardQuickViewHandler,
		createLoanActionItems,
		GRID_CARD_ACTION_PROPS
	} from '$lib/components/common/action-buttons';
	import {
		formatCurrency,
		formatDateVeryShort,
		formatPercentage,
		formatText
	} from '$lib/format';
	import { calculateTransactionStats } from '$lib/calculations';
	import {
		normalizeCommissionType,
		parseCommissionValue
	} from '$lib/commission';
	import { partyCommissionAmountForLoan } from '$lib/loan-list-summary';
	import { getLoanStatusBadge, getLoanTypeBadge } from '$lib/badge-config';
	import { cn } from '$lib/utils';
	import type { LoanWithInvestors } from '$lib/types';
	import GroupBadgeList from '$lib/components/groups/GroupBadgeList.svelte';
	import type { GroupChipSelection } from '$lib/components/groups/types';
	import { SHOW_GROUPS_UI } from '$lib/feature-flags';
	import {
		badgesForLoan,
		loanGroupIds,
		type GroupsIndexItem
	} from '$lib/groups/loan-group-filter';
	import { page } from '$app/state';
	import LoanPendingSignBadge from '$lib/components/loans/LoanPendingSignBadge.svelte';

	interface Props {
		loan: LoanWithInvestors;
		onQuickView?: (loan: LoanWithInvestors) => void;
		onEdit?: (loan: LoanWithInvestors) => void;
		onAddPayment?: (loan: LoanWithInvestors) => void;
		onAddReceivedPayment?: (loan: LoanWithInvestors) => void;
		onDuplicate?: (loan: LoanWithInvestors) => void;
		onContractDetails?: (loan: LoanWithInvestors) => void;
		onAddCommission?: (loan: LoanWithInvestors) => void;
		onDelete?: (loan: LoanWithInvestors) => void;
		onRemoveFromGroup?: (loan: LoanWithInvestors) => void;
		onGroupFilter?: (selection: Exclude<GroupChipSelection, 'all'>) => void;
		hideGroupBadges?: boolean;
		/** Commissioned tab: show the viewer's commission instead of loan interest. */
		showCommissionMetrics?: boolean;
		selectable?: boolean;
		selected?: boolean;
		onSelectedChange?: (selected: boolean) => void;
	}

	let {
		loan,
		onQuickView,
		onEdit,
		onAddPayment,
		onAddReceivedPayment,
		onDuplicate,
		onContractDetails,
		onAddCommission,
		onDelete,
		onRemoveFromGroup,
		onGroupFilter,
		hideGroupBadges = false,
		showCommissionMetrics = false,
		selectable = false,
		selected = false,
		onSelectedChange
	}: Props = $props();

	const stats = $derived(calculateTransactionStats(loan.loanInvestors));
	const commissionType = $derived(
		normalizeCommissionType(loan.myCommission?.profitType ?? 'rate')
	);
	const commissionValue = $derived(
		parseCommissionValue(loan.myCommission?.profitValue ?? '0')
	);
	const commissionAmount = $derived(
		showCommissionMetrics ? partyCommissionAmountForLoan(loan) : 0
	);
	const addedByRule = $derived(
		(loan as LoanWithInvestors & { groupSource?: string }).groupSource === 'rule'
	);
	const groupsIndex = $derived(
		((page.data as { groupsIndex?: GroupsIndexItem[] }).groupsIndex ?? []) as GroupsIndexItem[]
	);
	const showGroupRow = $derived(SHOW_GROUPS_UI && !hideGroupBadges);
	const groupBadges = $derived(showGroupRow ? badgesForLoan(loan, groupsIndex) : []);
	const isUngrouped = $derived(showGroupRow && loanGroupIds(loan).length === 0);

	const actionItems = $derived(
		createLoanActionItems({
			onEdit: onEdit ? () => onEdit(loan) : undefined,
			onAddPayment: onAddPayment ? () => onAddPayment(loan) : undefined,
			onAddReceivedPayment: onAddReceivedPayment ? () => onAddReceivedPayment(loan) : undefined,
			onDuplicate: onDuplicate ? () => onDuplicate(loan) : undefined,
			showDuplicate: Boolean(onDuplicate),
			onContractDetails: onContractDetails ? () => onContractDetails(loan) : undefined,
			onAddCommission: onAddCommission ? () => onAddCommission(loan) : undefined,
			onDelete: onDelete ? () => onDelete(loan) : undefined,
			onRemoveFromGroup: onRemoveFromGroup ? () => onRemoveFromGroup(loan) : undefined
		})
	);
</script>

<Card.Root class="flex h-full flex-col overflow-hidden transition-colors hover:border-primary/20">
	<Card.Header class="px-4 pt-4 pb-1">
		<div class="flex min-w-0 items-start gap-2">
			{#if selectable}
				<div class="shrink-0 pt-0.5" onclick={(event) => event.stopPropagation()}>
					<Checkbox
						checked={selected}
						onCheckedChange={(value) => onSelectedChange?.(Boolean(value))}
						aria-label={`Select ${loan.loanName}`}
					/>
				</div>
			{/if}
			<Card.Title class="min-w-0 flex-1 truncate text-sm sm:text-base">
				{formatText(loan.loanName)}
			</Card.Title>
		</div>
		{#if addedByRule}
			<Badge variant="secondary" class="mt-2 w-fit text-[10px]">Added by rule</Badge>
		{/if}
		<div class="mt-2 flex min-w-0 flex-wrap items-center gap-1">
			{#if showGroupRow && groupBadges.length > 0}
				<GroupBadgeList
					groups={groupBadges}
					onBadgeClick={(group, event) => {
						event.preventDefault();
						event.stopPropagation();
						onGroupFilter?.(group.id);
					}}
				/>
			{:else if showGroupRow && isUngrouped}
				<button
					type="button"
					class="inline-flex max-w-full min-w-0 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground native-press"
					onclick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						onGroupFilter?.('ungrouped');
					}}
				>
					<span
						class="size-2 shrink-0 rounded-full bg-muted-foreground/40"
						aria-hidden="true"
					></span>
					<span class="truncate">Ungrouped</span>
				</button>
			{/if}
			<Badge
				variant={getLoanTypeBadge(loan.type).variant}
				class={cn('shrink-0 text-[10px]', getLoanTypeBadge(loan.type).className)}
			>
				{formatText(loan.type)}
			</Badge>
			<Badge
				variant={getLoanStatusBadge(loan.status).variant}
				class={cn('shrink-0 text-[10px]', getLoanStatusBadge(loan.status).className)}
			>
				{formatText(loan.status)}
			</Badge>
			<LoanPendingSignBadge
				{loan}
				class="mt-0 shrink-0"
				onOpenContractDetails={onContractDetails ? () => onContractDetails(loan) : undefined}
			/>
		</div>
	</Card.Header>
	<Card.Content class="flex-1 space-y-3 px-4 pt-0 pb-3">
		<div class="grid grid-cols-2 gap-2">
			<div class="dashboard-metric-cell p-2">
				<p class="text-caption mb-1">Principal</p>
				<p class="text-sm font-medium">{formatCurrency(stats.totalPrincipal)}</p>
			</div>
			<div class="dashboard-metric-cell p-2">
				<p class="text-caption mb-1">Rate</p>
				<p class="text-sm font-medium">
					{showCommissionMetrics
						? commissionType === 'fixed'
							? 'Fixed'
							: formatPercentage(commissionValue)
						: formatPercentage(stats.averageRate)}
				</p>
			</div>
			<div class="dashboard-metric-cell p-2">
				<p class="text-caption mb-1">Due</p>
				<p class="text-sm font-medium">{formatDateVeryShort(loan.dueDate)}</p>
			</div>
			<div class="dashboard-metric-cell p-2">
				<p class="text-caption mb-1">
					{showCommissionMetrics ? 'Commission' : 'Interest'}
				</p>
				<p class="text-sm font-medium">
					{showCommissionMetrics
						? formatCurrency(commissionAmount)
						: formatCurrency(stats.totalInterest)}
				</p>
			</div>
		</div>
	</Card.Content>
	<Card.Footer class="border-t px-0 py-0">
		<ActionButtons
			viewHref={`/loans/${loan.id}`}
			{...GRID_CARD_ACTION_PROPS}
			{actionItems}
			onQuickView={createCardQuickViewHandler(
				onQuickView ? () => onQuickView(loan) : undefined
			)}
		/>
	</Card.Footer>
</Card.Root>
