<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import * as Card from '$lib/components/ui/card';
	import DownloadBackupButton from '$lib/components/common/DownloadBackupButton.svelte';
	import DataHealthCard from '$lib/components/settings/DataHealthCard.svelte';
	import AiUsageCard from '$lib/components/settings/AiUsageCard.svelte';
	import RecentlyDeletedCard from '$lib/components/settings/RecentlyDeletedCard.svelte';
	import LoanTemplatesManager from '$lib/components/settings/LoanTemplatesManager.svelte';
	import PaymentMethodsManager from '$lib/components/settings/PaymentMethodsManager.svelte';
	import PartyIdentityDocumentsManager from '$lib/components/settings/PartyIdentityDocumentsManager.svelte';
	import InstallAppCard from '$lib/components/settings/InstallAppCard.svelte';
	import PushNotificationsCard from '$lib/components/settings/PushNotificationsCard.svelte';
	import EmailNotificationsCard from '$lib/components/settings/EmailNotificationsCard.svelte';
	import AutoAttachSignatureCard from '$lib/components/settings/AutoAttachSignatureCard.svelte';
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

	<nav aria-label="Settings sections" class="flex flex-wrap gap-x-4 gap-y-2 text-sm">
		<a class="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" href="#settings-account">Account</a>
		<a class="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" href="#settings-templates">Templates</a>
		<a class="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" href="#settings-payments">Payments</a>
		<a class="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" href="#settings-notifications">Notifications</a>
		<a class="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" href="#settings-data">Data</a>
	</nav>

	<Card.Root id="settings-account">
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

	<div id="settings-templates">
		<LoanTemplatesManager
			initialTemplates={data.loanTemplates ?? []}
			borrowers={data.templateBorrowers ?? []}
			investors={data.templateInvestors ?? []}
			groups={data.templateGroups ?? []}
		/>
	</div>

	{#if hasPartyLinks}
		<div id="settings-identity">
			<PartyIdentityDocumentsManager initialDocuments={data.identityDocuments} />
		</div>
	{/if}

	<div id="settings-signing">
		<AutoAttachSignatureCard
			initialEnabled={data.signingPreferences?.autoAttachSignature === true}
			hasSavedSignature={data.hasSavedSignature === true}
		/>
	</div>

	<div id="settings-payments">
		<PaymentMethodsManager initialMethods={data.paymentMethods ?? []} />
	</div>

	{#if data.isPlatformOwner}
		<div id="settings-health"><DataHealthCard /></div>
		<div id="settings-usage"><AiUsageCard /></div>
		<div id="settings-deleted"><RecentlyDeletedCard /></div>
	{/if}

	<div id="settings-install"><InstallAppCard /></div>
	<div id="settings-notifications">
		<PushNotificationsCard initialPreferences={data.pushPreferences} />
		<EmailNotificationsCard
			initialPreferences={data.emailPreferences}
			emailConfigured={data.emailConfigured}
		/>
	</div>

	<Card.Root id="settings-data">
		<Card.Header>
			<Card.Title>Data & maintenance</Card.Title>
		</Card.Header>
		<Card.Content class="flex flex-wrap gap-2 max-lg:flex-col max-lg:*:w-full">
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
