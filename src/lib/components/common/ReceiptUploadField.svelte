<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import ImageUploadPreview from '$lib/components/common/ImageUploadPreview.svelte';
	import { persistImageDataUrl } from '$lib/storage-upload-client';
	import { readReceiptFileAsDataUrl } from '$lib/receipt-image';
	import { extractReceiptInfo } from '$lib/receipt-extraction-client';
	import { formatCurrency, formatDateVeryShort } from '$lib/format';
	import { toast } from '$lib/toast';
	import type { ReceiptExtractedData } from '$lib/receipt-extraction-types';
	import {
		MAX_PAYMENT_RECEIPTS,
		type PaymentReceipt
	} from '$lib/payment-receipts';
	import { CheckCircle2, HelpCircle, AlertTriangle, Plus, XCircle } from 'lucide-svelte';

	interface Props {
		receipts?: PaymentReceipt[];
		onChange: (receipts: PaymentReceipt[]) => void;
		onExtracted?: (extracted: ReceiptExtractedData | null) => void;
		disabled?: boolean;
		label?: string;
		idPrefix?: string;
	}

	let {
		receipts = [],
		onChange,
		onExtracted,
		disabled = false,
		label = 'Receipts (optional)',
		idPrefix
	}: Props = $props();

	let inputRef = $state<HTMLInputElement | null>(null);
	let isExtracting = $state(false);
	let scanError = $state<string | null>(null);
	const inputId = $derived(idPrefix ? `${idPrefix}-receipt-file` : undefined);
	const latestExtracted = $derived.by(() => {
		for (let i = receipts.length - 1; i >= 0; i -= 1) {
			if (receipts[i]?.extractedData) return receipts[i].extractedData;
		}
		return null;
	});
	const atLimit = $derived(receipts.length >= MAX_PAYMENT_RECEIPTS);

	const verdictMeta = $derived.by(() => {
		if (!latestExtracted) return null;
		switch (latestExtracted.verdict) {
			case 'valid':
				return { icon: CheckCircle2, class: 'text-emerald-600' };
			case 'likely_valid':
				return { icon: CheckCircle2, class: 'text-amber-600' };
			case 'unclear':
				return { icon: HelpCircle, class: 'text-amber-600' };
			case 'invalid':
				return { icon: AlertTriangle, class: 'text-destructive' };
			default:
				return null;
		}
	});

	async function processFile(file: File, working: PaymentReceipt[]): Promise<PaymentReceipt[]> {
		if (working.length >= MAX_PAYMENT_RECEIPTS) {
			toast.error(`You can attach up to ${MAX_PAYMENT_RECEIPTS} receipts.`);
			return working;
		}

		let dataUrl: string;
		try {
			dataUrl = await readReceiptFileAsDataUrl(file);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to upload receipt.');
			return working;
		}

		let next = [...working, { imageUrl: dataUrl, extractedData: null }];
		onChange(next);

		try {
			const result = await extractReceiptInfo(dataUrl);
			const storageRef = await persistImageDataUrl(dataUrl);
			const extracted = result.success ? result.data : null;
			next = next.map((item) =>
				item.imageUrl === dataUrl ? { imageUrl: storageRef, extractedData: extracted } : item
			);
			onChange(next);
			onExtracted?.(extracted);
			if (!result.success) scanError = result.error;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to upload receipt.');
		}

		return next;
	}

	async function handleFileChange(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const files = Array.from(target.files ?? []);
		target.value = '';
		if (files.length === 0) return;

		scanError = null;
		isExtracting = true;
		try {
			let working = [...receipts];
			for (const file of files) {
				working = await processFile(file, working);
			}
		} finally {
			isExtracting = false;
		}
	}

	function removeAt(index: number) {
		scanError = null;
		onChange(receipts.filter((_, i) => i !== index));
	}
</script>

<div class="space-y-2">
	<Label for={inputId}>{label}</Label>

	{#if receipts.length > 0}
		<div class="grid gap-3 sm:grid-cols-2">
			{#each receipts as receipt, index (receipt.imageUrl + index)}
				<ImageUploadPreview
					value={receipt.imageUrl}
					alt="Receipt {index + 1}"
					{disabled}
					isProcessing={isExtracting && index === receipts.length - 1}
					emptyLabel="Scan a receipt"
					previewClass="max-h-40 w-full object-contain"
					onPick={() => inputRef?.click()}
					onRemove={() => removeAt(index)}
				/>
			{/each}
		</div>
	{/if}

	{#if !atLimit}
		{#if receipts.length === 0}
			<ImageUploadPreview
				value={null}
				alt="Receipt preview"
				{disabled}
				isProcessing={isExtracting}
				emptyLabel="Scan receipts"
				previewClass="max-h-40 w-full object-contain"
				onPick={() => inputRef?.click()}
				onRemove={() => {}}
			/>
		{:else}
			<Button
				type="button"
				variant="outline"
				size="sm"
				class="w-full"
				disabled={disabled || isExtracting}
				onclick={() => inputRef?.click()}
			>
				<Plus class="mr-2 h-4 w-4" />
				Add receipt
			</Button>
		{/if}
	{/if}

	<input
		bind:this={inputRef}
		id={inputId}
		type="file"
		accept="image/jpeg,image/png,image/webp"
		multiple
		class="hidden"
		disabled={disabled || isExtracting || atLimit}
		onchange={handleFileChange}
	/>

	{#if latestExtracted}
		<div class="flex items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
			{#if verdictMeta}
				{@const Icon = verdictMeta.icon}
				<Icon class="mt-0.5 size-3.5 shrink-0 {verdictMeta.class}" aria-hidden="true" />
			{/if}
			<p class="text-muted-foreground">
				AI read:
				{#if latestExtracted.amount}
					<span class="font-medium text-foreground">{formatCurrency(latestExtracted.amount)}</span>
				{/if}
				{#if latestExtracted.transactionDate}
					· {formatDateVeryShort(latestExtracted.transactionDate)}
				{/if}
				{#if latestExtracted.senderName}
					· from {latestExtracted.senderName}{latestExtracted.senderBank ? ` (${latestExtracted.senderBank})` : ''}
				{/if}
				{#if !latestExtracted.amount && !latestExtracted.transactionDate && !latestExtracted.senderName}
					{latestExtracted.summary}
				{/if}
			</p>
		</div>
	{:else if scanError}
		<div class="flex items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
			<XCircle class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
			<p>{scanError}</p>
		</div>
	{/if}
</div>
