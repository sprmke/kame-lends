<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import * as Card from '$lib/components/ui/card';
	import DownloadBackupButton from '$lib/components/common/DownloadBackupButton.svelte';
	import FixReceivedPaymentsButton from '$lib/components/common/FixReceivedPaymentsButton.svelte';
	import SyncLoanDueDatesButton from '$lib/components/common/SyncLoanDueDatesButton.svelte';
	import SyncCalendarButton from '$lib/components/common/SyncCalendarButton.svelte';
	import PaymentMethodsManager from '$lib/components/settings/PaymentMethodsManager.svelte';
	import PartyIdentityDocumentsManager from '$lib/components/settings/PartyIdentityDocumentsManager.svelte';

	let { data } = $props();
	const isAdminWorkspace = $derived(Boolean(data.isAdminWorkspace));
	const hasPartyLinks = $derived(Boolean(data.hasPartyLinks));
</script>

<svelte:head><title>Settings</title></svelte:head>

<DashboardPage>
	<PageHeader
		title="Settings"
		description={isAdminWorkspace
			? 'Maintenance tools and data exports for your workspace.'
			: undefined}
		showPriceToggle={false}
	/>

	<Card.Root>
		<Card.Header class="pb-2">
			<Card.Title>Account</Card.Title>
		</Card.Header>
		<Card.Content>
			<dl class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[4.5rem_1fr]">
				<dt class="text-muted-foreground">Name</dt>
				<dd class="min-w-0 font-medium">{data.user?.name}</dd>
				<dt class="text-muted-foreground">Email</dt>
				<dd class="min-w-0 break-all font-medium">{data.user?.email}</dd>
				<dt class="text-muted-foreground">Role</dt>
				<dd class="min-w-0 font-medium capitalize">{data.user?.role}</dd>
			</dl>
		</Card.Content>
	</Card.Root>

	{#if hasPartyLinks}
		<PartyIdentityDocumentsManager initialDocuments={data.identityDocuments} />
	{/if}

	<PaymentMethodsManager initialMethods={data.paymentMethods ?? []} />

	{#if isAdminWorkspace}
		<Card.Root>
			<Card.Header>
				<Card.Title>Data & maintenance</Card.Title>
				<Card.Description class="max-w-3xl">
					Fix Payments repairs missing received-payment rows for completed interest periods and
					removes legacy orphan rows for multi-interest loans.
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-wrap gap-2 max-lg:flex-col max-lg:*:w-full">
				<SyncLoanDueDatesButton />
				<FixReceivedPaymentsButton />
				<DownloadBackupButton />
				<SyncCalendarButton />
			</Card.Content>
		</Card.Root>
	{/if}
</DashboardPage>
