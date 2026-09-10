<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import BorrowerForm from '$lib/components/borrowers/BorrowerForm.svelte';
</script>

<svelte:head><title>Create Borrower</title></svelte:head>

<DashboardPage class="max-w-2xl">
	<BorrowerForm cancelHref="/borrowers" successHref="/borrowers" />
</DashboardPage>
