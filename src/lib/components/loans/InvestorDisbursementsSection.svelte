<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { ArrowUpRight, ChevronDown, Wallet } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { formatCurrency, formatDate, formatText } from '$lib/format';
	import ReceiptThumbnails from '$lib/components/common/ReceiptThumbnails.svelte';
	import {
		type InvestorMetrics,
		type InvestorTransactionDisplay,
		formatCount
	} from './investor-transactions-helpers';

	interface Props {
		transactions: InvestorTransactionDisplay[];
		metrics: InvestorMetrics;
		open: boolean;
		onOpenChange: (open: boolean) => void;
		canMutate: boolean;
		loanId?: number;
		payingTransactions: Set<number | string>;
		onPay: (transactionId: number | string) => void;
	}

	let {
		transactions,
		metrics,
		open,
		onOpenChange,
		canMutate,
		loanId,
		payingTransactions,
		onPay
	}: Props = $props();
</script>

<section
	class="overflow-hidden rounded-lg border border-border/70 bg-background shadow-none"
	aria-label="Principal disbursements"
>
	<Collapsible.Root {open} {onOpenChange}>
		<Collapsible.Trigger
			class="flex w-full items-center gap-2.5 border-b border-border/50 bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
		>
			<div
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
			>
				<ArrowUpRight class="h-5 w-5" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="mt-0.5 text-sm font-semibold">Disbursements</p>
				<p class="mt-0.5 text-xs text-muted-foreground">
					{metrics.principalCount === 1
						? `${formatCount(1)} payment`
						: `${formatCount(metrics.principalCount)} payments`} · Total {formatCurrency(
						metrics.totalCapital
					)}
				</p>
			</div>
			<ChevronDown
				class={cn(
					'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
					open && 'rotate-180'
				)}
			/>
		</Collapsible.Trigger>
		<Collapsible.Content>
			<div class="space-y-2.5 bg-muted/10 p-3">
				{#each transactions as transaction, index (transaction.id ?? `t-${index}`)}
					{@const capital = parseFloat(transaction.amount) || 0}
					{@const isUnpaid = !transaction.isPaid}
					<div
						class={cn(
							'rounded-lg border border-border/60 bg-card p-3 shadow-sm',
							isUnpaid && 'border-amber-300/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/25'
						)}
					>
						<div class="flex items-center justify-between gap-3">
							<div class="flex min-w-0 items-center gap-2.5">
								<ArrowUpRight class="h-4 w-4 shrink-0 text-muted-foreground" />
								<div class="min-w-0">
									<p class="text-[11px] font-medium text-muted-foreground">Sent date</p>
									<p class="mt-0.5 text-sm font-semibold">
										{formatDate(transaction.sentDate)}
									</p>
								</div>
							</div>
							<div class="flex shrink-0 items-center gap-2">
								{#if isUnpaid}
									<Badge
										class="h-4 border-amber-200 bg-amber-100 px-1.5 py-0 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
									>
										Pending
									</Badge>
								{/if}
								<p class="text-sm font-bold tabular-nums">{formatCurrency(capital)}</p>
							</div>
						</div>
						{#if canMutate && isUnpaid && loanId && typeof transaction.id === 'number'}
							<Button
								size="sm"
								onclick={() => onPay(transaction.id!)}
								disabled={payingTransactions.has(transaction.id!)}
								class="mt-3 h-8 w-full bg-yellow-500 text-xs text-white hover:bg-yellow-600"
							>
								<Wallet class="mr-1.5 h-3 w-3" />
								{payingTransactions.has(transaction.id!) ? 'Paying…' : 'Mark as Paid'}
							</Button>
						{/if}
						<ReceiptThumbnails receipts={transaction.receipts ?? []} />
						{#if transaction.notes?.trim()}
							<p class="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
								{formatText(transaction.notes)}
							</p>
						{/if}
					</div>
				{/each}
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
</section>
