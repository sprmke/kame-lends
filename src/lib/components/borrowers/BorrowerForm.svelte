<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import ValidIdUpload from '$lib/components/common/ValidIdUpload.svelte';
	import ESignatureUpload from '$lib/components/common/ESignatureUpload.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import FormActions from '$lib/components/common/FormActions.svelte';
	import { cn } from '$lib/utils';
	import { toast } from '$lib/toast';
	import { normalizeValidIdUrl, normalizeSignatureImageUrl } from '$lib/valid-id-document';
	import type { Borrower } from '$lib/types';

	interface Props {
		existingBorrower?: Borrower;
		cancelHref?: string;
		successHref?: string;
		onSuccess?: (borrower: Borrower) => void | Promise<void>;
		onCancel?: () => void;
		/** Legacy alias for modal mode; prefer `showFormHeader={false}` in modals. */
		embedded?: boolean;
		showFormHeader?: boolean;
		formId?: string;
		isSubmitting?: boolean;
	}

	let {
		existingBorrower,
		cancelHref = '/borrowers',
		successHref,
		onSuccess,
		onCancel,
		embedded = false,
		showFormHeader,
		formId,
		isSubmitting = $bindable(false)
	}: Props = $props();

	const isEditMode = $derived(!!existingBorrower);
	const renderFormHeader = $derived(showFormHeader ?? !embedded);

	let formRef = $state<HTMLFormElement | null>(null);
	let name = $state(existingBorrower?.name ?? '');
	let contactNumber = $state(existingBorrower?.contactNumber ?? '');
	let email = $state(existingBorrower?.email ?? '');
	let address = $state(existingBorrower?.address ?? '');
	let notes = $state(existingBorrower?.notes ?? '');
	let validIdUrl = $state<string | null>(existingBorrower?.validIdUrl ?? null);
	let eSignatureUrl = $state<string | null>(existingBorrower?.eSignatureUrl ?? null);
	let errors = $state<Record<string, string>>({});

	function validate() {
		const next: Record<string, string> = {};
		if (!name.trim() || name.trim().length < 2) {
			next.name = 'Name is required (min 2 characters)';
		}
		if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
			next.email = 'Invalid email';
		}
		errors = next;
		return Object.keys(next).length === 0;
	}

	function handleFormSubmit() {
		formRef?.requestSubmit();
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!validate()) return;

		isSubmitting = true;
		try {
			const url = isEditMode ? `/api/borrowers/${existingBorrower!.id}` : '/api/borrowers';
			const method = isEditMode ? 'PUT' : 'POST';
			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					contactNumber: contactNumber.trim() || null,
					email: email.trim() || null,
					address: address.trim() || null,
					notes: notes.trim() || null,
					validIdUrl: normalizeValidIdUrl(validIdUrl),
					eSignatureUrl: normalizeSignatureImageUrl(eSignatureUrl)
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} borrower`
				);
			}

			const saved = (await response.json()) as Borrower;
			toast.success(isEditMode ? 'Borrower updated' : 'Borrower created');

			if (onSuccess) {
				await onSuccess(saved);
			} else {
				await goto(successHref ?? (isEditMode ? `/borrowers/${saved.id}` : cancelHref));
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
</script>

<form
	bind:this={formRef}
	id={formId}
	class={cn('dashboard-form w-full min-w-0', embedded ? 'max-w-none' : 'max-w-2xl')}
	onsubmit={handleSubmit}
>
	{#if renderFormHeader}
		<FormHeader
			title={isEditMode ? (existingBorrower?.name ?? 'Borrower') : 'Create Borrower'}
			description={isEditMode
				? 'Update borrower contact details'
				: 'Add a borrower for your loans'}
			onCancel={handleCancel}
			onSubmit={handleFormSubmit}
			{isSubmitting}
			{isEditMode}
			submitLabel={isSubmitting
				? isEditMode
					? 'Updating...'
					: 'Creating...'
				: isEditMode
					? 'Update'
					: 'Create'}
			variant="page"
		/>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>{isEditMode ? existingBorrower?.name : 'Borrower Information'}</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="space-y-2">
				<Label for="borrower-name">Full Name</Label>
				<Input id="borrower-name" bind:value={name} disabled={isSubmitting} required />
				{#if errors.name}<p class="text-sm text-destructive">{errors.name}</p>{/if}
			</div>

			<div class="space-y-2">
				<Label for="borrower-contactNumber">Contact Number</Label>
				<Input
					id="borrower-contactNumber"
					type="tel"
					bind:value={contactNumber}
					disabled={isSubmitting}
				/>
			</div>

			<div class="space-y-2">
				<Label for="borrower-email">Email Address</Label>
				<Input id="borrower-email" type="email" bind:value={email} disabled={isSubmitting} />
				{#if errors.email}<p class="text-sm text-destructive">{errors.email}</p>{/if}
			</div>

			<div class="space-y-2">
				<Label for="borrower-address">Address</Label>
				<Input id="borrower-address" bind:value={address} disabled={isSubmitting} />
			</div>

			<div class="space-y-2">
				<Label for="borrower-notes">Notes</Label>
				<Textarea id="borrower-notes" bind:value={notes} rows={3} disabled={isSubmitting} />
			</div>

			<ValidIdUpload
				value={validIdUrl}
				onChange={(value) => (validIdUrl = value)}
				disabled={isSubmitting}
			/>
			<ESignatureUpload
				value={eSignatureUrl}
				onChange={(value) => (eSignatureUrl = value)}
				disabled={isSubmitting}
			/>
		</Card.Content>
	</Card.Root>

	<FormActions
		onCancel={handleCancel}
		{formId}
		{isSubmitting}
		layout={embedded ? 'stacked' : 'responsive'}
		submitLabel={isSubmitting
			? isEditMode
				? 'Updating...'
				: 'Creating...'
			: isEditMode
				? 'Update'
				: 'Create'}
		class={embedded ? 'md:hidden' : 'lg:hidden'}
	/>
</form>
