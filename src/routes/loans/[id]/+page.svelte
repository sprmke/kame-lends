<script lang="ts">
	import { onMount } from 'svelte';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import LoanDetailClient from '$lib/components/loans/LoanDetailClient.svelte';
	import type { Borrower, Investor, LoanWithInvestors } from '$lib/types';

	let { data } = $props();

	const loan = $derived(data.entity as LoanWithInvestors);
	const title = $derived(loan?.loanName ?? 'Loan');

	let investors = $state<Investor[]>([]);
	let borrowers = $state<Borrower[]>([]);
	let loadingFormData = $state(true);

	onMount(async () => {
		try {
			const [investorRes, borrowerRes] = await Promise.all([
				fetch('/api/investors?simple=true'),
				fetch('/api/borrowers?simple=true')
			]);
			const investorData = await investorRes.json();
			const borrowerData = await borrowerRes.json();
			if (Array.isArray(investorData)) investors = investorData;
			if (Array.isArray(borrowerData)) borrowers = borrowerData;
		} catch (error) {
			console.error('Failed to load form data', error);
		} finally {
			loadingFormData = false;
		}
	});
</script>

<svelte:head><title>{title}</title></svelte:head>

<DashboardPage>
	<LoanDetailClient {loan} {investors} {borrowers} {loadingFormData} />
</DashboardPage>
