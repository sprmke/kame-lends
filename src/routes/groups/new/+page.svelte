<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import GroupForm from '$lib/components/groups/GroupForm.svelte';
</script>

<svelte:head><title>Create Group</title></svelte:head>

<DashboardPage class="max-w-2xl">
	<GroupForm />
</DashboardPage>
