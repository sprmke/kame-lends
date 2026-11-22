<script lang="ts">
	import FormPageSkeleton from './FormPageSkeleton.svelte';
	import DebtDetailSkeleton from './page-skeletons/DebtDetailSkeleton.svelte';
	import LoanDetailSkeleton from './page-skeletons/LoanDetailSkeleton.svelte';
	import InvestorDetailSkeleton from './page-skeletons/InvestorDetailSkeleton.svelte';
	import TransactionDetailSkeleton from './page-skeletons/TransactionDetailSkeleton.svelte';
	import BorrowerDetailSkeleton from './page-skeletons/BorrowerDetailSkeleton.svelte';
	import WitnessDetailSkeleton from './page-skeletons/WitnessDetailSkeleton.svelte';
	import SettingsPageSkeleton from './page-skeletons/SettingsPageSkeleton.svelte';
	import GroupDetailSkeleton from './page-skeletons/GroupDetailSkeleton.svelte';
	import SigningPageSkeleton from './page-skeletons/SigningPageSkeleton.svelte';
	import PartyProfileFormSkeleton from './page-skeletons/PartyProfileFormSkeleton.svelte';

	export type DetailPageSkeletonVariant =
		| 'debt'
		| 'loan'
		| 'investor'
		| 'transaction'
		| 'borrower'
		| 'witness'
		| 'group'
		| 'settings'
		| 'signing'
		| 'loan-form'
		| 'debt-form'
		| 'transaction-form'
		| 'party-form';

	interface Props {
		variant: DetailPageSkeletonVariant;
	}

	let { variant }: Props = $props();
</script>

<div class="dashboard-page">
	{#if variant === 'loan-form'}
		<div class="dashboard-form max-w-4xl">
			<FormPageSkeleton sections={2} />
		</div>
	{:else if variant === 'debt-form'}
		<div class="dashboard-form max-w-4xl">
			<FormPageSkeleton />
		</div>
	{:else if variant === 'transaction-form'}
		<FormPageSkeleton />
	{:else if variant === 'party-form'}
		<div class="dashboard-form max-w-2xl">
			<PartyProfileFormSkeleton showHeader />
		</div>
	{:else if variant === 'debt'}
		<DebtDetailSkeleton variant="page" />
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
	{:else if variant === 'group'}
		<GroupDetailSkeleton />
	{:else if variant === 'settings'}
		<SettingsPageSkeleton />
	{:else if variant === 'signing'}
		<SigningPageSkeleton />
	{/if}
</div>
