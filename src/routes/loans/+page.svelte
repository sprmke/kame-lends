<script lang="ts">
	import LoanListPage from '$lib/components/loans/LoanListPage.svelte';
	import { resolveLoanListPageScope } from '$lib/components/loans/loan-list-page-config';

	let { data } = $props();

	const pageScope = $derived(resolveLoanListPageScope(data.pageScope));
	const listData = $derived({
		loans: data.loans,
		pageTitle: data.pageTitle,
		emptyMessage: data.emptyMessage,
		canCreate: data.canCreate,
		canManage: data.canManage,
		userId: data.userId,
		myInvestorIds: data.myInvestorIds,
		myWitnessIds: data.myWitnessIds
	});
</script>

<LoanListPage
	data={listData}
	scope={pageScope}
	showScopeTabs={data.showScopeTabs === true}
/>
