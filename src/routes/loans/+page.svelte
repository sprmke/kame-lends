<script lang="ts">
	import LoanListPage from '$lib/components/loans/LoanListPage.svelte';
	import type { LoanListPageScope } from '$lib/components/loans/loan-list-page-config';

	let { data } = $props();

	const pageScope = $derived(data.pageScope as LoanListPageScope);
	const listData = $derived({
		loans: data.loans,
		pageTitle: data.pageTitle,
		emptyMessage: data.emptyMessage,
		canCreate: data.canCreate,
		canManage: data.canManage,
		profitStats: data.profitStats
	});
</script>

<LoanListPage
	data={listData}
	scope={pageScope}
	showScopeTabs={data.showScopeTabs === true}
/>
