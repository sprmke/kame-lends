<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import * as Card from '$lib/components/ui/card';
	import PaymentMethodsManager from '$lib/components/settings/PaymentMethodsManager.svelte';
	import SyncCalendarButton from '$lib/components/common/SyncCalendarButton.svelte';

	let { data } = $props();
	const isAdminWorkspace = $derived(Boolean(data.isAdminWorkspace));
</script>

<svelte:head><title>Settings</title></svelte:head>

<DashboardPage>
	<PageHeader title="Settings" description="" showPriceToggle={false} />

	<Card.Root>
		<Card.Content class="space-y-1.5 p-3">
			<p><span class="text-muted-foreground">Name</span> {data.user?.name}</p>
			<p><span class="text-muted-foreground">Email</span> {data.user?.email}</p>
			<p><span class="text-muted-foreground">Role</span> {data.user?.role}</p>
		</Card.Content>
	</Card.Root>

	{#if isAdminWorkspace}
		<PaymentMethodsManager initialMethods={data.paymentMethods ?? []} />

		<Card.Root>
			<Card.Header>
				<Card.Title>Data & maintenance</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-wrap gap-1.5 p-3 pt-0">
				<SyncCalendarButton />
			</Card.Content>
		</Card.Root>
	{/if}
</DashboardPage>
