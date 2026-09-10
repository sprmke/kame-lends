<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PartyUserEditForm from '$lib/components/party/PartyUserEditForm.svelte';
	import InvestorDetailContent from '$lib/components/investors/InvestorDetailContent.svelte';
	import InvestorFormModal from '$lib/components/investors/InvestorFormModal.svelte';
	import { createIsMobileOverlay } from '$lib/composables/use-media-query.svelte';
	import { invalidateAll } from '$app/navigation';
	import type { InvestorWithLoans, LoanWithInvestors } from '$lib/types';

	let { data } = $props();

	let isEditing = $state(false);
	const mobile = createIsMobileOverlay(
		typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
	);

	$effect(() => mobile.init());

	const investor = $derived(data.entity as InvestorWithLoans);
	const title = $derived(investor?.name ?? 'Investor');
	const loans = $derived((data.loans ?? []) as LoanWithInvestors[]);
	const canManage = $derived(Boolean(data.canManage));

	async function handleEditSuccess() {
		isEditing = false;
		await invalidateAll();
	}
</script>

<svelte:head><title>{title}</title></svelte:head>

<DashboardPage>
	{#if isEditing && canManage && !mobile.matches}
		<PartyUserEditForm
			entityType="investor"
			entityId={investor.id}
			displayName={investor.name}
			cancelHref="/investors/{investor.id}"
			onSuccess={handleEditSuccess}
			onCancel={() => (isEditing = false)}
		/>
	{:else}
		<InvestorDetailContent {investor} {loans} onEdit={() => (isEditing = true)} {canManage} />
	{/if}
</DashboardPage>

<InvestorFormModal
	open={isEditing && canManage && mobile.matches}
	existingInvestor={investor}
	onOpenChange={(open) => {
		if (!open) isEditing = false;
	}}
	onSuccess={handleEditSuccess}
/>
