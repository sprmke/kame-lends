<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import ValidIdUpload from '$lib/components/common/ValidIdUpload.svelte';
	import PaymentProviderSelect from '$lib/components/settings/PaymentProviderSelect.svelte';
	import { toast } from '$lib/toast';
	import { normalizeValidIdUrl } from '$lib/valid-id-document';
	import {
		DEFAULT_PAYMENT_PROVIDER,
		formatPaymentAccountNumberDisplay,
		paymentAccountNumberLabel,
		paymentAccountNumberPlaceholder,
		paymentProviderLabel,
		paymentQrAltText,
		validatePaymentAccountNumber,
		validatePaymentProvider
	} from '$lib/payment-providers';
	import type { PaymentMethod } from '$lib/types';
	import { Pencil, Plus, Trash2 } from 'lucide-svelte';
	import { MAX_PAYMENT_METHODS_PER_USER } from '$lib/payment-methods';
	import { cn } from '$lib/utils';

	interface Props {
		initialMethods?: PaymentMethod[];
		/** When set, admin manages payment methods for a linked party user. */
		managedUserId?: string | null;
		disabled?: boolean;
	}

	let { initialMethods = [], managedUserId = null, disabled = false }: Props = $props();

	const apiBase = $derived(
		managedUserId
			? `/api/party-users/${managedUserId}/payment-methods`
			: '/api/payment-methods'
	);

	let methods = $state<PaymentMethod[]>([...initialMethods]);
	let isFormOpen = $state(false);
	let editingId = $state<number | null>(null);
	let bankName = $state(DEFAULT_PAYMENT_PROVIDER);
	let accountNumber = $state('');
	let qrCodeUrl = $state<string | null>(null);
	let isSubmitting = $state(false);
	let deleteTarget = $state<PaymentMethod | null>(null);
	let isDeleting = $state(false);
	let fieldErrors = $state<Record<string, string>>({});

	const visibleMethods = $derived(
		isFormOpen && editingId != null ? methods.filter((m) => m.id !== editingId) : methods
	);

	$effect(() => {
		methods = [...initialMethods];
	});

	function resetForm() {
		editingId = null;
		bankName = DEFAULT_PAYMENT_PROVIDER;
		accountNumber = '';
		qrCodeUrl = null;
		fieldErrors = {};
		isFormOpen = false;
	}

	function openCreate() {
		editingId = null;
		bankName = DEFAULT_PAYMENT_PROVIDER;
		accountNumber = '';
		qrCodeUrl = null;
		fieldErrors = {};
		isFormOpen = true;
	}

	function openEdit(method: PaymentMethod) {
		editingId = method.id;
		bankName = method.bankName;
		accountNumber = method.accountNumber;
		qrCodeUrl = method.qrCodeUrl;
		fieldErrors = {};
		isFormOpen = true;
	}

	function validate() {
		const next: Record<string, string> = {};
		const providerError = validatePaymentProvider(bankName);
		if (providerError) next.bankName = providerError;

		if (!accountNumber.trim()) {
			next.accountNumber = 'Enter the account number';
		} else {
			const accountNumberError = validatePaymentAccountNumber(bankName, accountNumber);
			if (accountNumberError) next.accountNumber = accountNumberError;
		}

		fieldErrors = next;
		return Object.keys(next).length === 0;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!validate()) return;

		isSubmitting = true;
		try {
			const isEdit = editingId != null;
			const url = isEdit ? `${apiBase}/${editingId}` : apiBase;
			const response = await fetch(url, {
				method: isEdit ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bankName: bankName.trim(),
					accountNumber: accountNumber.trim(),
					qrCodeUrl: normalizeValidIdUrl(qrCodeUrl)
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Save failed');
			}

			const saved = (await response.json()) as PaymentMethod;
			if (isEdit) {
				methods = methods.map((m) => (m.id === saved.id ? saved : m));
				toast.success('Payment method updated');
			} else {
				methods = [...methods, saved];
				toast.success('Payment method added');
			}
			resetForm();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Save failed');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		isDeleting = true;
		try {
			const response = await fetch(`${apiBase}/${deleteTarget.id}`, {
				method: 'DELETE'
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Delete failed');
			}
			const deletedId = deleteTarget.id;
			methods = methods.filter((m) => m.id !== deletedId);
			if (editingId === deletedId) resetForm();
			toast.success('Payment method deleted');
			deleteTarget = null;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Delete failed');
		} finally {
			isDeleting = false;
		}
	}
</script>

<Card.Root>
	<Card.Header class="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
		<Card.Title>Payment methods</Card.Title>
		{#if !isFormOpen}
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={disabled || methods.length >= MAX_PAYMENT_METHODS_PER_USER}
				onclick={openCreate}
			>
				<Plus class="mr-1 h-3.5 w-3.5" />
				Add
			</Button>
		{/if}
	</Card.Header>
	<Card.Content class="space-y-3">
		{#if isFormOpen}
			<form
				class="space-y-4 rounded-xl border border-border/60 bg-card p-3 sm:p-4"
				onsubmit={handleSubmit}
			>
				<div class="space-y-1.5">
					<Label for="pm-bank-name">Bank or e-wallet</Label>
					<PaymentProviderSelect
						id="pm-bank-name"
						value={bankName}
						disabled={isSubmitting}
						onValueChange={(value) => {
							bankName = value;
							if (fieldErrors.bankName) {
								const { bankName: _, ...rest } = fieldErrors;
								fieldErrors = rest;
							}
						}}
						class={cn(fieldErrors.bankName && 'border-destructive')}
					/>
					{#if fieldErrors.bankName}
						<p class="text-destructive text-xs">{fieldErrors.bankName}</p>
					{/if}
				</div>
				<div class="space-y-1.5">
					<Label for="pm-account-number">{paymentAccountNumberLabel(bankName)}</Label>
					<Input
						id="pm-account-number"
						bind:value={accountNumber}
						inputmode="numeric"
						autocomplete="off"
						placeholder={paymentAccountNumberPlaceholder(bankName)}
						disabled={isSubmitting}
						aria-invalid={Boolean(fieldErrors.accountNumber)}
						class={cn('h-11 tabular-nums', fieldErrors.accountNumber && 'border-destructive')}
					/>
					{#if fieldErrors.accountNumber}
						<p class="text-destructive text-xs">{fieldErrors.accountNumber}</p>
					{/if}
				</div>
				<ValidIdUpload
					label="QR code"
					buttonLabel="Upload QR"
					value={qrCodeUrl}
					onChange={(value) => (qrCodeUrl = value)}
					disabled={isSubmitting}
					idPrefix="pm-qr"
				/>
				<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-start">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="min-h-11 w-full sm:w-auto"
						disabled={isSubmitting}
						onclick={resetForm}
					>
						Cancel
					</Button>
					<Button type="submit" size="sm" class="min-h-11 w-full sm:w-auto" disabled={isSubmitting}>
						{isSubmitting ? 'Saving...' : editingId != null ? 'Save' : 'Add'}
					</Button>
				</div>
			</form>
		{/if}

		{#if disabled && managedUserId == null}
			<p class="text-muted-foreground text-sm">Add an email to manage payment methods.</p>
		{:else if visibleMethods.length === 0 && !isFormOpen}
			<p class="text-muted-foreground text-sm">No payment methods</p>
		{:else if visibleMethods.length > 0}
			<ul class="space-y-2">
				{#each visibleMethods as method (method.id)}
					<li class="flex items-start justify-between gap-2 rounded-xl border border-border/60 p-3">
						<div class="min-w-0 space-y-1">
							<p class="text-sm font-medium">{paymentProviderLabel(method.bankName)}</p>
							<p class="text-muted-foreground text-sm break-all tabular-nums">
								{formatPaymentAccountNumberDisplay(method.bankName, method.accountNumber)}
							</p>
							{#if method.qrCodeUrl}
								<img
									src={method.qrCodeUrl}
									alt={paymentQrAltText(method.bankName)}
									class="mt-2 max-h-28 rounded-lg border border-border bg-white object-contain p-1"
								/>
							{/if}
						</div>
						<div class="flex shrink-0 gap-1">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								class="touch-target"
								aria-label="Edit payment method"
								disabled={disabled || isFormOpen}
								onclick={() => openEdit(method)}
							>
								<Pencil class="h-3.5 w-3.5" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								class="touch-target"
								aria-label="Delete payment method"
								disabled={disabled}
								onclick={() => (deleteTarget = method)}
							>
								<Trash2 class="h-3.5 w-3.5" />
							</Button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</Card.Content>
</Card.Root>

<AlertDialog.Root
	open={deleteTarget !== null}
	onOpenChange={(open) => {
		if (!open && !isDeleting) deleteTarget = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete payment method</AlertDialog.Title>
			<AlertDialog.Description>
				Remove {deleteTarget ? paymentProviderLabel(deleteTarget.bankName) : 'this'} account from
				your payment methods?
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				disabled={isDeleting}
				onclick={(event) => {
					event.preventDefault();
					void handleDelete();
				}}
			>
				{isDeleting ? 'Deleting...' : 'Delete'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
