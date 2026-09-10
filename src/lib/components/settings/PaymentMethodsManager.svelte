<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import ValidIdUpload from '$lib/components/common/ValidIdUpload.svelte';
	import { toast } from '$lib/toast';
	import { normalizeValidIdUrl } from '$lib/valid-id-document';
	import type { PaymentMethod } from '$lib/types';
	import { Pencil, Plus, Trash2 } from 'lucide-svelte';
	import { MAX_PAYMENT_METHODS_PER_USER } from '$lib/payment-methods';

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
	let bankName = $state('');
	let accountNumber = $state('');
	let qrCodeUrl = $state<string | null>(null);
	let isSubmitting = $state(false);
	let deleteTarget = $state<PaymentMethod | null>(null);
	let isDeleting = $state(false);
	let fieldErrors = $state<Record<string, string>>({});
	let bankInputEl = $state<HTMLInputElement | null>(null);

	const visibleMethods = $derived(
		isFormOpen && editingId != null ? methods.filter((m) => m.id !== editingId) : methods
	);

	$effect(() => {
		methods = [...initialMethods];
	});

	function resetForm() {
		editingId = null;
		bankName = '';
		accountNumber = '';
		qrCodeUrl = null;
		fieldErrors = {};
		isFormOpen = false;
	}

	function openCreate() {
		editingId = null;
		bankName = '';
		accountNumber = '';
		qrCodeUrl = null;
		fieldErrors = {};
		isFormOpen = true;
		queueMicrotask(() => bankInputEl?.focus());
	}

	function openEdit(method: PaymentMethod) {
		editingId = method.id;
		bankName = method.bankName;
		accountNumber = method.accountNumber;
		qrCodeUrl = method.qrCodeUrl;
		fieldErrors = {};
		isFormOpen = true;
		queueMicrotask(() => bankInputEl?.focus());
	}

	function validate() {
		const next: Record<string, string> = {};
		if (!bankName.trim()) next.bankName = 'Required';
		if (!accountNumber.trim()) next.accountNumber = 'Required';
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
			<form class="space-y-3 rounded-md border border-border p-3" onsubmit={handleSubmit}>
				<div class="space-y-1.5">
					<Label for="pm-bank-name">Bank name</Label>
					<Input
						id="pm-bank-name"
						bind:ref={bankInputEl}
						bind:value={bankName}
						autocomplete="organization"
						disabled={isSubmitting}
					/>
					{#if fieldErrors.bankName}
						<p class="text-destructive text-xs">{fieldErrors.bankName}</p>
					{/if}
				</div>
				<div class="space-y-1.5">
					<Label for="pm-account-number">Account number</Label>
					<Input
						id="pm-account-number"
						bind:value={accountNumber}
						inputmode="numeric"
						autocomplete="off"
						disabled={isSubmitting}
					/>
					{#if fieldErrors.accountNumber}
						<p class="text-destructive text-xs">{fieldErrors.accountNumber}</p>
					{/if}
				</div>
				<ValidIdUpload
					label="QR code"
					buttonLabel="Upload QR code"
					value={qrCodeUrl}
					onChange={(value) => (qrCodeUrl = value)}
					disabled={isSubmitting}
					idPrefix="pm-qr"
				/>
				<div class="flex flex-wrap gap-1.5">
					<Button type="submit" size="sm" disabled={isSubmitting}>
						{isSubmitting ? 'Saving...' : editingId != null ? 'Save' : 'Add'}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={isSubmitting}
						onclick={resetForm}
					>
						Cancel
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
					<li class="flex items-start justify-between gap-2 rounded-md border border-border p-2.5">
						<div class="min-w-0 space-y-1">
							<p class="text-sm font-medium">{method.bankName}</p>
							<p class="text-muted-foreground text-sm break-all">{method.accountNumber}</p>
							{#if method.qrCodeUrl}
								<img
									src={method.qrCodeUrl}
									alt="QR code"
									class="mt-1 max-h-24 rounded border border-border bg-white object-contain p-1"
								/>
							{/if}
						</div>
						<div class="flex shrink-0 gap-1">
							<Button
								type="button"
								variant="ghost"
								size="icon"
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
				Remove {deleteTarget?.bankName ?? 'this'} account from your payment methods?
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
