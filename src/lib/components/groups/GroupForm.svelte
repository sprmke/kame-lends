<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import FormActions from '$lib/components/common/FormActions.svelte';
	import { cn } from '$lib/utils';
	import { toast } from '$lib/toast';
	import type { LoanGroup } from '$lib/types';

	interface Props {
		existingGroup?: LoanGroup;
		cancelHref?: string;
		successHref?: string;
		onSuccess?: (group: LoanGroup) => void | Promise<void>;
		onCancel?: () => void;
		showFormHeader?: boolean;
		formId?: string;
		isSubmitting?: boolean;
	}

	let {
		existingGroup,
		cancelHref = '/groups',
		successHref = '/groups',
		onSuccess,
		onCancel,
		showFormHeader,
		formId,
		isSubmitting = $bindable(false)
	}: Props = $props();

	const isEditMode = $derived(!!existingGroup);

	let name = $state(existingGroup?.name ?? '');
	let notes = $state(existingGroup?.notes ?? '');
	let errors = $state<Record<string, string>>({});
	let formRef = $state<HTMLFormElement | null>(null);

	const renderFormHeader = $derived(showFormHeader ?? !onSuccess);

	function validate() {
		const next: Record<string, string> = {};
		if (!name.trim() || name.trim().length < 2) next.name = 'Name is required (min 2 characters)';
		errors = next;
		return Object.keys(next).length === 0;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!validate()) return;

		isSubmitting = true;
		try {
			const url = isEditMode ? `/api/groups/${existingGroup!.id}` : '/api/groups';
			const method = isEditMode ? 'PUT' : 'POST';
			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					notes: notes.trim() || undefined
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} group`);
			}

			const savedGroup = (await response.json()) as LoanGroup;
			toast.success(isEditMode ? 'Group updated' : 'Group created');
			if (onSuccess) {
				await onSuccess(savedGroup);
			} else {
				await goto(successHref);
			}
		} catch (error) {
			console.error(error);
			toast.error(error instanceof Error ? error.message : 'Save failed');
		} finally {
			isSubmitting = false;
		}
	}

	function handleCancel() {
		if (onCancel) {
			onCancel();
			return;
		}
		goto(cancelHref);
	}

	function handleFormSubmit() {
		formRef?.requestSubmit();
	}
</script>

<form
	bind:this={formRef}
	id={formId}
	class={cn('dashboard-form w-full min-w-0', onSuccess ? 'max-w-none' : 'max-w-2xl')}
	onsubmit={handleSubmit}
>
	{#if renderFormHeader}
		<FormHeader
			title={isEditMode ? (existingGroup?.name ?? 'Group') : 'Create Group'}
			description={isEditMode ? 'Update group details' : 'Create a group to organize loans'}
			onCancel={handleCancel}
			onSubmit={handleFormSubmit}
			{isSubmitting}
			{isEditMode}
			submitLabel={isSubmitting
				? isEditMode
					? 'Updating...'
					: 'Creating...'
				: isEditMode
					? 'Update Group'
					: 'Create Group'}
			variant="page"
		/>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>Group Details</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="space-y-2">
				<Label for="name">Group Name</Label>
				<Input id="name" bind:value={name} disabled={isSubmitting} required />
				{#if errors.name}<p class="text-sm text-destructive">{errors.name}</p>{/if}
			</div>
			<div class="space-y-2">
				<Label for="notes">Notes</Label>
				<Textarea id="notes" bind:value={notes} disabled={isSubmitting} rows={3} />
			</div>
		</Card.Content>
	</Card.Root>

	<FormActions
		onCancel={handleCancel}
		{formId}
		{isSubmitting}
		layout={onSuccess ? 'stacked' : 'responsive'}
		submitLabel={isSubmitting
			? isEditMode
				? 'Updating...'
				: 'Creating...'
			: isEditMode
				? 'Update Group'
				: 'Create Group'}
		class={onSuccess ? 'md:hidden' : 'lg:hidden'}
	/>
</form>
