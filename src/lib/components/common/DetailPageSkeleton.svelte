<script lang="ts">
	import FormPageSkeleton from './FormPageSkeleton.svelte';
	import DebtDetailSkeleton from './page-skeletons/DebtDetailSkeleton.svelte';
	import LoanDetailSkeleton from './page-skeletons/LoanDetailSkeleton.svelte';
	import InvestorDetailSkeleton from './page-skeletons/InvestorDetailSkeleton.svelte';
	import TransactionDetailSkeleton from './page-skeletons/TransactionDetailSkeleton.svelte';
	import BorrowerDetailSkeleton from './page-skeletons/BorrowerDetailSkeleton.svelte';
	import WitnessDetailSkeleton from './page-skeletons/WitnessDetailSkeleton.svelte';
	import SettingsPageSkeleton from './page-skeletons/SettingsPageSkeleton.svelte';
	import DetailHeaderSkeleton from './page-skeletons/DetailHeaderSkeleton.svelte';

	export type DetailPageSkeletonVariant =
		| 'debt'
		| 'loan'
		| 'investor'
		| 'transaction'
		| 'borrower'
		| 'witness'
		| 'settings'
		| 'form';

	interface Props {
		variant: DetailPageSkeletonVariant;
	}

	let { variant }: Props = $props();
</script>

<div class="dashboard-page">
	{#if variant === 'form'}
		<FormPageSkeleton />
	{:else if variant === 'debt'}
		<div class="dashboard-form max-w-4xl">
			<DetailHeaderSkeleton />
			<DebtDetailSkeleton />
		</div>
	{:else if variant === 'loan'}
		<LoanDetailSkeleton />
	{:else if variant === 'investor'}
		<InvestorDetailSkeleton />
	{:else if variant === 'transaction'}
		<TransactionDetailSkeleton />
	{:else if variant === 'borrower'}
		<BorrowerDetailSkeleton />
	{:else if variant === 'witness'}
		<WitnessDetailSkeleton />
	{:else if variant === 'settings'}
		<SettingsPageSkeleton />
	{/if}
</div>
