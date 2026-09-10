<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
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

	interface Props {
		loan: LoanWithInvestors;
		onQuickView?: (loan: LoanWithInvestors) => void;
		onEdit?: (loan: LoanWithInvestors) => void;
		onAddPayment?: (loan: LoanWithInvestors) => void;
		onAddReceivedPayment?: (loan: LoanWithInvestors) => void;
		onDuplicate?: (loan: LoanWithInvestors) => void;
		onContractDetails?: (loan: LoanWithInvestors) => void;
		onDelete?: (loan: LoanWithInvestors) => void;
	}

	let {
		loan,
		onQuickView,
		onEdit,
		onAddPayment,
		onAddReceivedPayment,
		onDuplicate,
		onContractDetails,
		onDelete
	}: Props = $props();

	const stats = $derived(calculateTransactionStats(loan.loanInvestors));

	const actionItems = $derived(
		createLoanActionItems({
			onEdit: onEdit ? () => onEdit(loan) : undefined,
			onAddPayment: onAddPayment ? () => onAddPayment(loan) : undefined,
			onAddReceivedPayment: onAddReceivedPayment ? () => onAddReceivedPayment(loan) : undefined,
			onDuplicate: onDuplicate ? () => onDuplicate(loan) : undefined,
			showDuplicate: Boolean(onDuplicate),
			onContractDetails: onContractDetails ? () => onContractDetails(loan) : undefined,
			onDelete: onDelete ? () => onDelete(loan) : undefined
		})
	);
</script>

<Card.Root class="flex h-full flex-col overflow-hidden transition-colors hover:border-primary/20">
	<Card.Header class="px-4 pt-4 pb-1">
		<div class="flex items-start justify-between gap-2">
			<Card.Title class="truncate text-sm sm:text-base">{formatText(loan.loanName)}</Card.Title>
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
