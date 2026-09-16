<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import * as Card from '$lib/components/ui/card';
	import DownloadBackupButton from '$lib/components/common/DownloadBackupButton.svelte';
	import FixReceivedPaymentsButton from '$lib/components/common/FixReceivedPaymentsButton.svelte';
	import SyncLoanDueDatesButton from '$lib/components/common/SyncLoanDueDatesButton.svelte';
	import PaymentMethodsManager from '$lib/components/settings/PaymentMethodsManager.svelte';
	import PartyIdentityDocumentsManager from '$lib/components/settings/PartyIdentityDocumentsManager.svelte';
	import { formatAccountRoles } from '$lib/account-roles';
	import { PAGE_DESCRIPTIONS } from '$lib/page-descriptions';

	let { data } = $props();
	const hasPartyLinks = $derived(Boolean(data.hasPartyLinks));
	const rolesLabel = $derived(formatAccountRoles(data.accountRoles ?? []));
</script>

<svelte:head><title>Settings</title></svelte:head>

<DashboardPage>
	<PageHeader
		title="Settings"
		description={PAGE_DESCRIPTIONS.settings}
		showPriceToggle={false}
	/>

	<Card.Root>
		<Card.Header class="pb-2">
			<Card.Title>Account</Card.Title>
		</Card.Header>
		<Card.Content>
			<dl class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[5rem_1fr]">
				<dt class="text-muted-foreground">Name</dt>
				<dd class="min-w-0 font-medium">{data.user?.name}</dd>
				<dt class="text-muted-foreground">Email</dt>
				<dd class="min-w-0 break-all font-medium">{data.user?.email}</dd>
				<dt class="text-muted-foreground">Roles</dt>
				<dd class="min-w-0 font-medium">{rolesLabel}</dd>
			</dl>
		</Card.Content>
	</Card.Root>

	{#if hasPartyLinks}
		<PartyIdentityDocumentsManager initialDocuments={data.identityDocuments} />
	{/if}

	<PaymentMethodsManager initialMethods={data.paymentMethods ?? []} />

	<Card.Root>
		<Card.Header>
			<Card.Title>Data & maintenance</Card.Title>
		</Card.Header>
		<Card.Content class="flex flex-wrap gap-2 max-lg:flex-col max-lg:*:w-full">
			<SyncLoanDueDatesButton />
			<FixReceivedPaymentsButton />
			<DownloadBackupButton downloadLabel="Download my data" />
			{#if data.isPlatformOwner}
				<DownloadBackupButton
					downloadLabel="Download all data"
					backupUrl="/api/backup?download=true&scope=all"
				/>
			{/if}
		</Card.Content>
	</Card.Root>
</DashboardPage>
