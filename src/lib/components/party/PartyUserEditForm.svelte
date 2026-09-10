<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import ValidIdUpload from '$lib/components/common/ValidIdUpload.svelte';
	import ESignatureUpload from '$lib/components/common/ESignatureUpload.svelte';
	import PaymentMethodsManager from '$lib/components/settings/PaymentMethodsManager.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import FormActions from '$lib/components/common/FormActions.svelte';
	import { cn } from '$lib/utils';
	import { toast } from '$lib/toast';
	import { normalizeSignatureImageUrl, normalizeValidIdUrl } from '$lib/valid-id-document';
	import type { PartyEntityType, PartyUserProfile } from '$lib/party-profile';

	interface Props {
		entityType: PartyEntityType;
		entityId: number;
		displayName?: string;
		cancelHref?: string;
		onSuccess?: () => void | Promise<void>;
		onCancel?: () => void;
		showFormHeader?: boolean;
		embedded?: boolean;
		formId?: string;
		isSubmitting?: boolean;
		showNotes?: boolean;
	}

	let {
		entityType,
		entityId,
		displayName,
		cancelHref,
		onSuccess,
		onCancel,
		showFormHeader,
		embedded = false,
		formId,
		isSubmitting = $bindable(false),
		showNotes = entityType === 'borrower'
	}: Props = $props();

	const renderFormHeader = $derived(showFormHeader ?? !embedded);
	const profileUrl = $derived(`/api/party-profiles/${entityType}/${entityId}`);

	let formRef = $state<HTMLFormElement | null>(null);
	let isLoading = $state(true);
	let linkedRoles = $state<PartyEntityType[]>([]);
	let partyUserId = $state<string | null>(null);
	let name = $state('');
	let contactNumber = $state('');
	let email = $state('');
	let address = $state('');
	let notes = $state('');
	let validIdUrl = $state<string | null>(null);
	let eSignatureUrl = $state<string | null>(null);
	let paymentMethods = $state<PartyUserProfile['paymentMethods']>([]);
	let errors = $state<Record<string, string>>({});

	const title = $derived(displayName?.trim() || name.trim() || 'Contact');
	const emailRequired = $derived(
		entityType === 'investor' || linkedRoles.includes('investor')
	);

	function applyProfile(profile: PartyUserProfile) {
		linkedRoles = profile.linkedRoles;
		partyUserId = profile.partyUserId;
		name = profile.name;
		contactNumber = profile.contactNumber ?? '';
		email = profile.email ?? '';
		address = profile.address ?? '';
		notes = profile.notes ?? '';
		validIdUrl = profile.validIdUrl;
		eSignatureUrl = profile.eSignatureUrl;
		paymentMethods = profile.paymentMethods;
	}

	async function loadProfile() {
		isLoading = true;
		try {
			const response = await fetch(profileUrl);
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to load profile');
			}
			applyProfile((await response.json()) as PartyUserProfile);
		} catch (error) {
			console.error(error);
			toast.error(error instanceof Error ? error.message : 'Failed to load profile');
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		void loadProfile();
	});

	function validate() {
		const next: Record<string, string> = {};
		if (!name.trim() || name.trim().length < 2) {
			next.name = 'Name is required (min 2 characters)';
		}
		if (emailRequired) {
			if (!email.trim()) next.email = 'Email is required';
			else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
				next.email = 'Invalid email';
			}
		} else if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
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
			const response = await fetch(profileUrl, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					contactNumber: contactNumber.trim() || null,
					email: email.trim() || null,
					address: address.trim() || null,
					notes: showNotes ? notes.trim() || null : null,
					validIdUrl: normalizeValidIdUrl(validIdUrl),
					eSignatureUrl: normalizeSignatureImageUrl(eSignatureUrl)
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Update failed');
			}

			applyProfile((await response.json()) as PartyUserProfile);
			toast.success('Contact updated');
			await onSuccess?.();
		} catch (error) {
			console.error(error);
			toast.error(error instanceof Error ? error.message : 'Update failed');
		} finally {
			isSubmitting = false;
		}
	}

	function handleCancel() {
		if (onCancel) {
			onCancel();
			return;
		}
		if (cancelHref) {
			void goto(cancelHref);
		}
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
			title={title}
			description="Update contact details"
			onCancel={handleCancel}
			onSubmit={handleFormSubmit}
			{isSubmitting}
			isEditMode={true}
			submitLabel={isSubmitting ? 'Updating...' : 'Update'}
			variant="page"
		/>
	{/if}

	{#if isLoading}
		<Card.Root>
			<Card.Content class="py-8">
				<p class="text-muted-foreground text-sm">Loading...</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>Contact details</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="party-name">Full Name</Label>
					<Input id="party-name" bind:value={name} disabled={isSubmitting} required />
					{#if errors.name}<p class="text-sm text-destructive">{errors.name}</p>{/if}
				</div>

				<div class="space-y-2">
					<Label for="party-contactNumber">Contact Number</Label>
					<Input
						id="party-contactNumber"
						type="tel"
						bind:value={contactNumber}
						disabled={isSubmitting}
					/>
				</div>

				<div class="space-y-2">
					<Label for="party-email">Email Address</Label>
					<Input
						id="party-email"
						type="email"
						bind:value={email}
						disabled={isSubmitting}
						required={emailRequired}
					/>
					{#if errors.email}<p class="text-sm text-destructive">{errors.email}</p>{/if}
				</div>

				<div class="space-y-2">
					<Label for="party-address">Address</Label>
					<Input id="party-address" bind:value={address} disabled={isSubmitting} />
				</div>

				{#if showNotes}
					<div class="space-y-2">
						<Label for="party-notes">Notes</Label>
						<Textarea id="party-notes" bind:value={notes} rows={3} disabled={isSubmitting} />
					</div>
				{/if}

				<ValidIdUpload
					value={validIdUrl}
					onChange={(value) => (validIdUrl = value)}
					disabled={isSubmitting}
					idPrefix="party"
				/>
				<ESignatureUpload
					value={eSignatureUrl}
					onChange={(value) => (eSignatureUrl = value)}
					disabled={isSubmitting}
					idPrefix="party"
				/>
			</Card.Content>
		</Card.Root>

		<div class="mt-4">
			{#key `${partyUserId ?? 'none'}-${paymentMethods.length}`}
				<PaymentMethodsManager
					initialMethods={paymentMethods}
					managedUserId={partyUserId}
					disabled={!partyUserId || isSubmitting}
				/>
			{/key}
		</div>
	{/if}

	<FormActions
		onCancel={handleCancel}
		{formId}
		{isSubmitting}
		layout={embedded ? 'stacked' : 'responsive'}
		submitLabel={isSubmitting ? 'Updating...' : 'Update'}
		class={embedded ? 'md:hidden' : 'lg:hidden'}
	/>
</form>
