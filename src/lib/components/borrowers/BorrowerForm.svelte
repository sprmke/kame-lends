<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import ValidIdUpload from '$lib/components/common/ValidIdUpload.svelte';
	import ESignatureUpload from '$lib/components/common/ESignatureUpload.svelte';
	import { toast } from '$lib/toast';
	import { normalizeValidIdUrl, normalizeSignatureImageUrl } from '$lib/valid-id-document';
	import type { Borrower } from '$lib/types';

	interface Props {
		existingBorrower?: Borrower;
		cancelHref?: string;
		successHref?: string;
		onSuccess?: (borrower: Borrower) => void | Promise<void>;
		onCancel?: () => void;
	}

	let {
		existingBorrower,
		cancelHref = '/loans',
		successHref,
		onSuccess,
		onCancel
	}: Props = $props();

	const isEditMode = $derived(!!existingBorrower);

	let name = $state(existingBorrower?.name ?? '');
	let contactNumber = $state(existingBorrower?.contactNumber ?? '');
	let email = $state(existingBorrower?.email ?? '');
	let address = $state(existingBorrower?.address ?? '');
	let notes = $state(existingBorrower?.notes ?? '');
	let validIdUrl = $state<string | null>(existingBorrower?.validIdUrl ?? null);
	let eSignatureUrl = $state<string | null>(existingBorrower?.eSignatureUrl ?? null);
	let isSubmitting = $state(false);
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

<form class="dashboard-form max-w-2xl" onsubmit={handleSubmit}>
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

	<div class="flex flex-col gap-3 sm:flex-row">
		<Button
			type="button"
			variant="outline"
			class="flex-1"
			disabled={isSubmitting}
			onclick={handleCancel}
		>
			Cancel
		</Button>
		<Button type="submit" class="flex-1" disabled={isSubmitting}>
			{isSubmitting
				? isEditMode
					? 'Updating...'
					: 'Creating...'
				: isEditMode
					? 'Update Borrower'
					: 'Create Borrower'}
		</Button>
	</div>
</form>
