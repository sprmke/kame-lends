<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import LoanForm from '$lib/components/loans/LoanForm.svelte';
	import FormPageSkeleton from '$lib/components/common/FormPageSkeleton.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import type { Borrower, Investor } from '$lib/types';
	import type { DuplicateLoanData } from '$lib/loan-duplicate';

	let investors = $state<Investor[]>([]);
	let borrowers = $state<Borrower[]>([]);
	let loading = $state(true);
	let duplicateData = $state<DuplicateLoanData | null>(null);

	const preselectedInvestorId = $derived(
		Number($page.url.searchParams.get('investorId')) || undefined
	);

	const pageTitle = $derived(
		duplicateData ? 'Duplicate Loan' : preselectedInvestorId ? 'Create Loan' : 'Create Loan'
	);

	onMount(async () => {
		const duplicateParam = $page.url.searchParams.get('duplicate');
		if (duplicateParam) {
			try {
				duplicateData = JSON.parse(atob(decodeURIComponent(duplicateParam))) as DuplicateLoanData;
			} catch (error) {
				console.error('Failed to parse duplicate loan data', error);
			}
		}

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
			loading = false;
		}
	});
</script>

<svelte:head><title>{pageTitle}</title></svelte:head>

<DashboardPage class="max-w-4xl">
	{#if loading}
		<FormPageSkeleton />
	{:else}
		<LoanForm {investors} {borrowers} {preselectedInvestorId} {duplicateData} />
	{/if}
</DashboardPage>
