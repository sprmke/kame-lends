<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import TransactionForm from '$lib/components/transactions/TransactionForm.svelte';
	import FormPageSkeleton from '$lib/components/common/FormPageSkeleton.svelte';
	import type { Investor } from '$lib/types';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onSuccess?: () => void | Promise<void>;
	}

	let { open, onOpenChange, onSuccess }: Props = $props();

	let investors = $state<Investor[]>([]);
	let isLoading = $state(false);
	let isSubmitting = $state(false);

	const formId = 'transaction-create-form';
	const submitLabel = $derived(isSubmitting ? 'Creating...' : 'Create');

	$effect(() => {
		if (!open) return;
		let active = true;
		isLoading = true;
		fetch('/api/investors?simple=true')
			.then((response) => response.json())
			.then((data) => {
				if (active && Array.isArray(data)) investors = data;
			})
			.catch((error) => console.error('Error fetching investors:', error))
			.finally(() => {
				if (active) isLoading = false;
			});
		return () => {
			active = false;
		};
	});

	async function handleSuccess() {
		onOpenChange(false);
		await onSuccess?.();
	}
</script>

<ResponsiveModal {open} {onOpenChange} showCloseButton={false} contentClass="sm:max-w-lg">
	{#snippet header()}
		<FormHeader
			title="Create Transaction"
			{formId}
			onCancel={() => onOpenChange(false)}
			{isSubmitting}
			isEditMode={false}
			{submitLabel}
			variant="embedded"
		/>
	{/snippet}

	{#if isLoading}
		<FormPageSkeleton />
	{:else}
		<TransactionForm
			{investors}
			{formId}
			bind:isSubmitting
			onSuccess={handleSuccess}
			onCancel={() => onOpenChange(false)}
		/>
	{/if}
</ResponsiveModal>
