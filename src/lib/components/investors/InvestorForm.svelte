<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import { toast } from '$lib/toast';
	import type { Investor } from '$lib/types';

	interface Props {
		existingInvestor?: Investor;
		cancelHref?: string;
		successHref?: string;
		onSuccess?: (investor: Investor) => void | Promise<void>;
		onCancel?: () => void;
	}

	let {
		existingInvestor,
		cancelHref = '/investors',
		successHref = '/investors',
		onSuccess,
		onCancel
	}: Props = $props();

	const isEditMode = $derived(!!existingInvestor);

	let name = $state(existingInvestor?.name ?? '');
	let email = $state(existingInvestor?.email ?? '');
	let contactNumber = $state(existingInvestor?.contactNumber ?? '');
	let address = $state(existingInvestor?.address ?? '');
	let isSubmitting = $state(false);
	let errors = $state<Record<string, string>>({});
	let formRef = $state<HTMLFormElement | null>(null);

	const showFormHeader = $derived(!onSuccess);

	function validate() {
		const next: Record<string, string> = {};
		if (!name.trim() || name.trim().length < 2) next.name = 'Name is required (min 2 characters)';
		if (!email.trim()) next.email = 'Email is required';
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Invalid email';
		errors = next;
		return Object.keys(next).length === 0;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!validate()) return;

		isSubmitting = true;
		try {
			const url = isEditMode ? `/api/investors/${existingInvestor!.id}` : '/api/investors';
			const method = isEditMode ? 'PUT' : 'POST';
			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					email: email.trim(),
					contactNumber: contactNumber.trim() || undefined,
					address: address.trim() || undefined
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(
					errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} investor`
				);
			}

			const savedInvestor = (await response.json()) as Investor;
			toast.success(isEditMode ? 'Investor updated' : 'Investor created');
			if (onSuccess) {
				await onSuccess(savedInvestor);
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

<form bind:this={formRef} class="dashboard-form max-w-2xl" onsubmit={handleSubmit}>
	{#if showFormHeader}
		<FormHeader
			title={isEditMode ? (existingInvestor?.name ?? 'Investor') : 'Create Investor'}
			description={isEditMode
				? 'Update investor contact details'
				: 'Add a new investor to your portfolio'}
			onCancel={handleCancel}
			onSubmit={handleFormSubmit}
			{isSubmitting}
			{isEditMode}
			submitLabel={isSubmitting
				? isEditMode
					? 'Updating...'
					: 'Creating...'
				: isEditMode
					? 'Update Investor'
					: 'Create Investor'}
		/>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title class="dashboard-section-title">Contact Details</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="space-y-2">
				<Label for="name">Full Name</Label>
				<Input id="name" bind:value={name} disabled={isSubmitting} required />
				{#if errors.name}<p class="text-sm text-destructive">{errors.name}</p>{/if}
			</div>
			<div class="space-y-2">
				<Label for="email">Email Address</Label>
				<Input id="email" type="email" bind:value={email} disabled={isSubmitting} required />
				{#if errors.email}<p class="text-sm text-destructive">{errors.email}</p>{/if}
			</div>
			<div class="space-y-2">
				<Label for="contactNumber">Contact Number</Label>
				<Input id="contactNumber" type="tel" bind:value={contactNumber} disabled={isSubmitting} />
			</div>
			<div class="space-y-2">
				<Label for="address">Address</Label>
				<Input id="address" bind:value={address} disabled={isSubmitting} />
			</div>
		</Card.Content>
	</Card.Root>

	<div class="flex flex-col gap-3 sm:flex-row">
		<Button
			type="button"
			variant="outline"
			class="flex-1"
			disabled={isSubmitting}
			onclick={() => (onCancel ? onCancel() : goto(cancelHref))}
		>
			Cancel
		</Button>
		<Button type="submit" class="flex-1" disabled={isSubmitting}>
			{isSubmitting ? 'Saving...' : isEditMode ? 'Update Investor' : 'Create Investor'}
		</Button>
	</div>
</form>
