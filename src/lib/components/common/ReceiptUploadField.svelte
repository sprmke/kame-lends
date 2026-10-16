<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import ImageUploadPreview from '$lib/components/common/ImageUploadPreview.svelte';
	import { persistImageDataUrl } from '$lib/storage-upload-client';
	import { readReceiptFileAsDataUrl, RECEIPT_FILE_ACCEPT } from '$lib/receipt-image';
	import {
		extractReceiptInfo,
		type ReceiptScanContext
	} from '$lib/receipt-extraction-client';
	import { formatCurrency, formatDateVeryShort } from '$lib/format';
	import { toast } from '$lib/toast';
	import type { ReceiptExtractedData, ReceiptWarning } from '$lib/receipt-extraction-types';
	import {
		MAX_PAYMENT_RECEIPTS,
		type PaymentReceipt
	} from '$lib/payment-receipts';
	import {
		groupScannedReceipts,
		type ScannedReceipt
	} from '$lib/receipt-scan/group-transactions';
	import { warningLabel } from '$lib/receipt-scan/warning-labels';
	import { useAiStatus } from '$lib/ai-status.svelte';
	import { CheckCircle2, HelpCircle, AlertTriangle, Plus, Split, XCircle } from 'lucide-svelte';

	interface Props {
		receipts?: PaymentReceipt[];
		onChange: (receipts: PaymentReceipt[]) => void;
		onExtracted?: (extracted: ReceiptExtractedData | null) => void;
		/** Purpose + ids so the AI knows which side of the transfer is the lender. */
		scanContext?: ReceiptScanContext;
		/**
		 * Called when one upload holds several separate transfers (different dates,
		 * or a transaction-history screenshot). The parent splits the row into one
		 * row per transfer.
		 */
		onSplitRequest?: (scanned: ScannedReceipt[]) => void;
		disabled?: boolean;
		/** Show the "AI read: …" line. Off when the row already shows its own scan notes. */
		showReading?: boolean;
		/** At least one image. Label becomes "Receipts *". */
		required?: boolean;
		error?: string | null;
		label?: string;
		idPrefix?: string;
	}

	let {
		receipts = [],
		onChange,
		onExtracted,
		scanContext,
		onSplitRequest,
		disabled = false,
		showReading = true,
		required = false,
		error = null,
		label,
		idPrefix
	}: Props = $props();

	const fieldLabel = $derived(label ?? (required ? 'Receipts *' : 'Receipts (optional)'));
	const ai = useAiStatus();

	let inputRef = $state<HTMLInputElement | null>(null);
	let isExtracting = $state(false);
	let scanError = $state<string | null>(null);
	let lastWarnings = $state<ReceiptWarning[]>([]);
	/** Scanned batch that looks like several transfers, waiting for "Split". */
	let splitCandidate = $state<{ scanned: ScannedReceipt[]; count: number } | null>(null);
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

	async function processFile(
		file: File,
		working: PaymentReceipt[]
	): Promise<{ receipts: PaymentReceipt[]; scanned: ScannedReceipt | null }> {
		if (working.length >= MAX_PAYMENT_RECEIPTS) {
			toast.error(`You can attach up to ${MAX_PAYMENT_RECEIPTS} receipts.`);
			return { receipts: working, scanned: null };
		}

		let dataUrl: string;
		try {
			dataUrl = await readReceiptFileAsDataUrl(file);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to upload receipt.');
			return { receipts: working, scanned: null };
		}

		let next = [...working, { imageUrl: dataUrl, extractedData: null }];
		onChange(next);

		try {
			await ai.ready();
			// Scan the in-memory image and upload it at the same time. AI off → upload only.
			const [result, storageRef] = await Promise.all([
				ai.receiptExtraction
					? extractReceiptInfo(dataUrl, scanContext)
					: Promise.resolve({ success: false as const, error: '' }),
				persistImageDataUrl(dataUrl)
			]);
			const extracted = result.success ? result.data : null;
			next = next.map((item) =>
				item.imageUrl === dataUrl ? { imageUrl: storageRef, extractedData: extracted } : item
			);
			onChange(next);
			onExtracted?.(extracted);
			if (!result.success && result.error) scanError = result.error;
			lastWarnings = result.success ? result.warnings : [];
			return {
				receipts: next,
				scanned: {
					id: crypto.randomUUID(),
					fileName: file.name,
					receipt: { imageUrl: storageRef, extractedData: extracted },
					extracted,
					warnings: result.success ? result.warnings : [],
					imageHash: result.success ? result.imageHash : null,
					error: result.success ? null : result.error || null
				}
			};
		} catch (error) {
			next = next.filter((item) => item.imageUrl !== dataUrl);
			onChange(next);
			toast.error(error instanceof Error ? error.message : 'Failed to upload receipt.');
			return { receipts: next, scanned: null };
		}
	}

	/** Distinct transfers (by date) across this batch — more than one means "split me". */
	function countTransfers(scanned: ScannedReceipt[]): number {
		if (!scanContext) return 0;
		return groupScannedReceipts(scanned, {
			purpose: scanContext.purpose,
			lenders: [],
			defaultInvestorId: 0
		}).proposals.filter((proposal) => proposal.transferCount > 0).length;
	}

	async function handleFileChange(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const files = Array.from(target.files ?? []);
		target.value = '';
		if (files.length === 0) return;

		scanError = null;
		splitCandidate = null;
		isExtracting = true;
		const batch: ScannedReceipt[] = [];
		try {
			let working = [...receipts];
			for (const file of files) {
				const outcome = await processFile(file, working);
				working = outcome.receipts;
				if (outcome.scanned) batch.push(outcome.scanned);
			}
		} finally {
			isExtracting = false;
		}

		if (onSplitRequest) {
			const count = countTransfers(batch);
			if (count > 1) splitCandidate = { scanned: batch, count };
		}
	}

	function removeAt(index: number) {
		scanError = null;
		lastWarnings = [];
		splitCandidate = null;
		onChange(receipts.filter((_, i) => i !== index));
	}
</script>

<div class="space-y-2">
	<Label for={inputId}>{fieldLabel}</Label>

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
				emptyLabel="Upload receipts"
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
		accept={RECEIPT_FILE_ACCEPT}
		multiple
		class="hidden"
		disabled={disabled || isExtracting || atLimit}
		onchange={handleFileChange}
	/>

	{#if latestExtracted && showReading}
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
		{@const recorded = lastWarnings.find((warning) => warning.code === 'already_recorded')}
		{#if recorded}
			<p class="flex items-center gap-1.5 text-xs text-destructive">
				<AlertTriangle class="size-3.5 shrink-0" aria-hidden="true" />
				{warningLabel(recorded)}
			</p>
		{/if}
	{:else if scanError}
		<div class="flex items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
			<XCircle class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
			<p>{scanError}</p>
		</div>
	{/if}

	{#if error}
		<p class="text-sm text-destructive">{error}</p>
	{/if}

	{#if splitCandidate && onSplitRequest}
		<div
			class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs"
		>
			<p class="text-muted-foreground">
				These look like {splitCandidate.count} separate transfers.
			</p>
			<Button
				type="button"
				variant="outline"
				size="sm"
				{disabled}
				onclick={() => {
					if (!splitCandidate) return;
					onSplitRequest?.(splitCandidate.scanned);
					splitCandidate = null;
				}}
			>
				<Split class="mr-1.5 h-3.5 w-3.5" />
				Split into {splitCandidate.count}
			</Button>
		</div>
	{/if}
</div>
