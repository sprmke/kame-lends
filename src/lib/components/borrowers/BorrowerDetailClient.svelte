<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DetailHeader from '$lib/components/common/DetailHeader.svelte';
	import PartyUserEditForm from '$lib/components/party/PartyUserEditForm.svelte';
	import BorrowerDetailContent from '$lib/components/borrowers/BorrowerDetailContent.svelte';
	import EditFormSheet from '$lib/components/common/EditFormSheet.svelte';
	import { createIsMobileOverlay } from '$lib/composables/use-media-query.svelte';
	import { toast } from '$lib/toast';
	import type { BorrowerWithLoans } from '$lib/types';

	interface Props {
		initialBorrower: BorrowerWithLoans;
		canManage?: boolean;
	}

	let { initialBorrower, canManage = true }: Props = $props();

	let borrower = $state<BorrowerWithLoans>(initialBorrower);
	let isEditing = $state($page.url.searchParams.get('edit') === '1' && canManage);
	let editSubmitting = $state(false);
	const mobile = createIsMobileOverlay(
		typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
	);
	const editFormId = $derived(`borrower-detail-edit-${borrower.id}`);

	$effect(() => mobile.init());

	const canDelete = $derived(canManage && (borrower.loans?.length ?? 0) === 0);

	async function refreshBorrower() {
		try {
			const response = await fetch(`/api/borrowers/${borrower.id}`);
			if (!response.ok) throw new Error('Failed to fetch borrower');
			borrower = (await response.json()) as BorrowerWithLoans;
		} catch (error) {
			console.error(error);
		}
	}

	async function handleDelete() {
		const response = await fetch(`/api/borrowers/${borrower.id}`, { method: 'DELETE' });
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.error || 'Failed to delete borrower');
		}
		toast.success('Borrower deleted');
		await goto('/borrowers');
	}
</script>

{#if isEditing && !mobile.matches}
	<div class="mx-auto max-w-2xl">
		{#key borrower.id}
			<PartyUserEditForm
				entityType="borrower"
				entityId={borrower.id}
				displayName={borrower.name}
				cancelHref="/borrowers/{borrower.id}"
				onSuccess={async () => {
					isEditing = false;
					await refreshBorrower();
				}}
				onCancel={() => (isEditing = false)}
			/>
		{/key}
	</div>
{:else}
	<div class="dashboard-form max-w-3xl">
		<DetailHeader
			title={borrower.name}
			description="Borrower contact and loan history"
			backLabel="Back to Borrowers"
			onBack={() => goto('/borrowers')}
			onEdit={canManage ? () => (isEditing = true) : undefined}
			onDelete={handleDelete}
			deleteTitle="Delete borrower?"
			deleteDescription={`Delete ${borrower.name}? This cannot be undone.`}
			canEdit={canManage}
			{canDelete}
			deleteWarning={`Cannot delete this borrower because they have ${borrower.loans?.length ?? 0} loan(s).`}
			showPriceToggle={false}
		/>

		<BorrowerDetailContent {borrower} showHeader={false} />
	</div>
{/if}

{#if isEditing && mobile.matches}
	<EditFormSheet
		open={true}
		onOpenChange={(open) => {
			if (!open) isEditing = false;
		}}
		title={borrower.name}
		formId={editFormId}
		isSubmitting={editSubmitting}
		isEditMode={true}
		submitLabel={editSubmitting ? 'Updating...' : 'Update'}
		contentClass="sm:max-w-lg"
	>
		{#key borrower.id}
			<PartyUserEditForm
				entityType="borrower"
				entityId={borrower.id}
				displayName={borrower.name}
				formId={editFormId}
				embedded
				showFormHeader={false}
				bind:isSubmitting={editSubmitting}
				onSuccess={async () => {
					isEditing = false;
					await refreshBorrower();
				}}
				onCancel={() => (isEditing = false)}
			/>
		{/key}
	</EditFormSheet>
{/if}
