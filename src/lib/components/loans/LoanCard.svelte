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
	import { getLoanStatusBadge, getLoanTypeBadge } from '$lib/badge-config';
	import { cn } from '$lib/utils';
	import type { LoanWithInvestors } from '$lib/types';
	import GroupBadgeList from '$lib/components/groups/GroupBadgeList.svelte';
	import { badgesForLoan, type GroupsIndexItem } from '$lib/groups/loan-group-filter';
	import { page } from '$app/state';

	interface Props {
		loan: LoanWithInvestors;
		onQuickView?: (loan: LoanWithInvestors) => void;
		onEdit?: (loan: LoanWithInvestors) => void;
		onAddPayment?: (loan: LoanWithInvestors) => void;
		onAddReceivedPayment?: (loan: LoanWithInvestors) => void;
		onDuplicate?: (loan: LoanWithInvestors) => void;
		onContractDetails?: (loan: LoanWithInvestors) => void;
		onDelete?: (loan: LoanWithInvestors) => void;
		onRemoveFromGroup?: (loan: LoanWithInvestors) => void;
		onGroupFilter?: (groupId: number) => void;
		hideGroupBadges?: boolean;
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
		onDelete,
		onRemoveFromGroup,
		onGroupFilter,
		hideGroupBadges = false,
		selectable = false,
		selected = false,
		onSelectedChange
	}: Props = $props();

	const stats = $derived(calculateTransactionStats(loan.loanInvestors));
	const addedByRule = $derived(
		(loan as LoanWithInvestors & { groupSource?: string }).groupSource === 'rule'
	);
	const groupsIndex = $derived(
		((page.data as { groupsIndex?: GroupsIndexItem[] }).groupsIndex ?? []) as GroupsIndexItem[]
	);
	const groupBadges = $derived(
		hideGroupBadges ? [] : badgesForLoan(loan, groupsIndex)
	);

	const actionItems = $derived(
		createLoanActionItems({
			onEdit: onEdit ? () => onEdit(loan) : undefined,
			onAddPayment: onAddPayment ? () => onAddPayment(loan) : undefined,
			onAddReceivedPayment: onAddReceivedPayment ? () => onAddReceivedPayment(loan) : undefined,
			onDuplicate: onDuplicate ? () => onDuplicate(loan) : undefined,
			showDuplicate: Boolean(onDuplicate),
			onContractDetails: onContractDetails ? () => onContractDetails(loan) : undefined,
			onDelete: onDelete ? () => onDelete(loan) : undefined,
			onRemoveFromGroup: onRemoveFromGroup ? () => onRemoveFromGroup(loan) : undefined
		})
	);
</script>

<Card.Root class="flex h-full flex-col overflow-hidden transition-colors hover:border-primary/20">
	<Card.Header class="px-4 pt-4 pb-1">
		<div class="flex items-start justify-between gap-2">
			<div class="flex min-w-0 items-start gap-2">
				{#if selectable}
					<div class="pt-0.5" onclick={(event) => event.stopPropagation()}>
						<Checkbox
							checked={selected}
							onCheckedChange={(value) => onSelectedChange?.(Boolean(value))}
							aria-label={`Select ${loan.loanName}`}
						/>
					</div>
				{/if}
				<Card.Title class="truncate text-sm sm:text-base">{formatText(loan.loanName)}</Card.Title>
			</div>
			<div class="flex shrink-0 gap-1">
				<Badge
					variant={getLoanTypeBadge(loan.type).variant}
					class={cn('text-[10px]', getLoanTypeBadge(loan.type).className)}
				>
					{formatText(loan.type)}
				</Badge>
				<Badge
					variant={getLoanStatusBadge(loan.status).variant}
					class={cn('text-[10px]', getLoanStatusBadge(loan.status).className)}
				>
					{formatText(loan.status)}
				</Badge>
			</div>
		</div>
		{#if addedByRule}
			<Badge variant="secondary" class="mt-2 w-fit text-[10px]">Added by rule</Badge>
		{/if}
		{#if groupBadges.length > 0}
			<div class="mt-2">
				<GroupBadgeList
					groups={groupBadges}
					onBadgeClick={(group, event) => {
						event.preventDefault();
						event.stopPropagation();
						onGroupFilter?.(group.id);
					}}
				/>
			</div>
		{/if}
	</Card.Header>
	<Card.Content class="flex-1 space-y-3 px-4 pt-0 pb-3">
		<div class="grid grid-cols-2 gap-2">
			<div class="dashboard-metric-cell p-2">
				<p class="text-caption mb-1">Principal</p>
				<p class="text-sm font-medium">{formatCurrency(stats.totalPrincipal)}</p>
			</div>
			<div class="dashboard-metric-cell p-2">
				<p class="text-caption mb-1">Rate</p>
				<p class="text-sm font-medium">{formatPercentage(stats.averageRate)}</p>
			</div>
			<div class="dashboard-metric-cell p-2">
				<p class="text-caption mb-1">Due</p>
				<p class="text-sm font-medium">{formatDateVeryShort(loan.dueDate)}</p>
			</div>
			<div class="dashboard-metric-cell p-2">
				<p class="text-caption mb-1">Interest</p>
				<p class="text-sm font-medium">{formatCurrency(stats.totalInterest)}</p>
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
