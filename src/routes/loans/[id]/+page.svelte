<script lang="ts">
	import { onMount } from 'svelte';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import LoanDetailClient from '$lib/components/loans/LoanDetailClient.svelte';
	import { loadPartyOptions } from '$lib/composables/party-options';
	import { EMPTY_LOAN_ACCESS } from '$lib/loan-access';
	import type { Borrower, Investor, LoanWithInvestors } from '$lib/types';

	let { data } = $props();

	const loan = $derived(data.entity as LoanWithInvestors);
	const access = $derived(data.access ?? EMPTY_LOAN_ACCESS);
	const canSignContract = $derived(data.canSignContract ?? false);
	const paymentMethods = $derived(data.paymentMethods ?? []);
	const title = $derived(loan?.loanName ?? 'Loan');

	let investors = $state<Investor[]>([]);
	let borrowers = $state<Borrower[]>([]);
	let loadingFormData = $state(true);

	onMount(async () => {
		if (!access?.canAdminEdit) {
			loadingFormData = false;
			return;
		}
		try {
			const options = await loadPartyOptions();
			investors = options.investors;
			borrowers = options.borrowers;
		} catch (error) {
			console.error('Failed to load form data', error);
		} finally {
			loadingFormData = false;
		}
	});
</script>

<svelte:head><title>{title}</title></svelte:head>

<DashboardPage>
	<LoanDetailClient
		{loan}
		{investors}
		{borrowers}
		{loadingFormData}
		{access}
		{canSignContract}
		{paymentMethods}
	/>
</DashboardPage>
