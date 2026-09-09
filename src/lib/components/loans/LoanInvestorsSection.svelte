<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Users } from 'lucide-svelte';
	import InvestorTransactionsDisplay from './InvestorTransactionsDisplay.svelte';
	import type { InvestorWithTransactions } from './investor-transactions-helpers';

	interface Props {
		investorsWithTransactions: InvestorWithTransactions[];
		title?: string;
		showEmail?: boolean;
		loanId?: number;
		onRefresh?: () => void | Promise<void>;
		showPeriodStatus?: boolean;
	}

	let {
		investorsWithTransactions,
		title = 'Investors',
		showEmail = true,
		loanId,
		onRefresh,
		showPeriodStatus = true
	}: Props = $props();
</script>

<Card.Root id="investors-section" class={title ? '' : 'border-0 p-0'}>
	{#if title}
		<Card.Header>
			<Card.Title class="dashboard-section-title">{title}</Card.Title>
		</Card.Header>
	{/if}
	<Card.Content class={title ? '' : 'p-0'}>
		{#if investorsWithTransactions.length === 0}
			<div class="dashboard-empty gap-2">
				<Users class="h-8 w-8 text-muted-foreground" />
				<p class="text-sm text-muted-foreground">No investors allocated</p>
			</div>
		{:else}
			<InvestorTransactionsDisplay
				{investorsWithTransactions}
				{showEmail}
				{loanId}
				{onRefresh}
				{showPeriodStatus}
			/>
		{/if}
	</Card.Content>
</Card.Root>
