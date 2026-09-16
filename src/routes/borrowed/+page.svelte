<script lang="ts">
	import LoanListPage from '$lib/components/loans/LoanListPage.svelte';

	let { data } = $props();
</script>

<LoanListPage {data} scope="borrowed" />
