<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DetailHeader from '$lib/components/common/DetailHeader.svelte';
	import WitnessForm from '$lib/components/witnesses/WitnessForm.svelte';
	import WitnessDetailContent from '$lib/components/witnesses/WitnessDetailContent.svelte';
	import EditFormSheet from '$lib/components/common/EditFormSheet.svelte';
	import { createIsMobileOverlay } from '$lib/composables/use-media-query.svelte';
	import { countWitnessedLoans } from '$lib/witness-loans';
	import { toast } from '$lib/toast';
	import type { WitnessWithLoans } from '$lib/types';

	interface Props {
		initialWitness: WitnessWithLoans;
	}

	let { initialWitness }: Props = $props();

	let witness = $state<WitnessWithLoans>(initialWitness);
	let isEditing = $state($page.url.searchParams.get('edit') === '1');
	let editSubmitting = $state(false);
	const mobile = createIsMobileOverlay(
		typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
	);
	const editFormId = $derived(`witness-detail-edit-${witness.id}`);

	$effect(() => mobile.init());

	const canDelete = $derived((witness.signingInvitations?.length ?? 0) === 0);

	async function refreshWitness() {
		try {
			const response = await fetch(`/api/witnesses/${witness.id}`);
			if (!response.ok) throw new Error('Failed to fetch witness');
			witness = (await response.json()) as WitnessWithLoans;
		} catch (error) {
			console.error(error);
		}
	}

	async function handleDelete() {
		const response = await fetch(`/api/witnesses/${witness.id}`, { method: 'DELETE' });
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.error || 'Failed to delete witness');
		}
		toast.success('Witness deleted');
		await goto('/witnesses');
	}
</script>

{#if isEditing && !mobile.matches}
	<div class="mx-auto max-w-2xl">
		{#key witness.id}
			<WitnessForm
				existingWitness={witness}
				cancelHref="/witnesses/{witness.id}"
				successHref="/witnesses/{witness.id}"
				onSuccess={async () => {
					isEditing = false;
					await refreshWitness();
				}}
				onCancel={() => (isEditing = false)}
			/>
		{/key}
	</div>
{:else}
	<div class="dashboard-form max-w-3xl">
		<DetailHeader
			title={witness.name}
			backLabel="Back to Witnesses"
			onBack={() => goto('/witnesses')}
			onEdit={() => (isEditing = true)}
			onDelete={handleDelete}
			deleteTitle="Delete witness?"
			deleteDescription={`Delete ${witness.name}? This cannot be undone.`}
			{canDelete}
			deleteWarning={`Cannot delete this witness because they have ${countWitnessedLoans(witness)} witnessed loan(s).`}
			showPriceToggle={false}
		/>

		<WitnessDetailContent {witness} showHeader={false} />
	</div>
{/if}

{#if isEditing && mobile.matches}
	<EditFormSheet
		open={true}
		onOpenChange={(open) => {
			if (!open) isEditing = false;
		}}
		title={witness.name}
		formId={editFormId}
		isSubmitting={editSubmitting}
		isEditMode={true}
		submitLabel={editSubmitting ? 'Updating...' : 'Update'}
		contentClass="sm:max-w-lg"
	>
		{#key witness.id}
			<WitnessForm
				existingWitness={witness}
				formId={editFormId}
				showFormHeader={false}
				bind:isSubmitting={editSubmitting}
				onSuccess={async () => {
					isEditing = false;
					await refreshWitness();
				}}
				onCancel={() => (isEditing = false)}
			/>
		{/key}
	</EditFormSheet>
{/if}
