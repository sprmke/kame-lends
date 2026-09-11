<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import ImageUploadPreview from '$lib/components/common/ImageUploadPreview.svelte';
	import { readReceiptFileAsDataUrl } from '$lib/receipt-image';
	import { extractReceiptInfo } from '$lib/receipt-extraction-client';
	import { formatCurrency, formatDateVeryShort } from '$lib/format';
	import { toast } from '$lib/toast';
	import type { ReceiptExtractedData } from '$lib/receipt-extraction-types';
	import { CheckCircle2, HelpCircle, AlertTriangle, XCircle } from 'lucide-svelte';

	interface Props {
		value?: string | null;
		extracted?: ReceiptExtractedData | null;
		onExtracted: (dataUrl: string, extracted: ReceiptExtractedData | null) => void;
		onRemove: () => void;
		disabled?: boolean;
		label?: string;
		idPrefix?: string;
	}

	let {
		value = null,
		extracted = null,
		onExtracted,
		onRemove,
		disabled = false,
		label = 'Receipt (optional)',
		idPrefix
	}: Props = $props();

	let inputRef = $state<HTMLInputElement | null>(null);
	let isExtracting = $state(false);
	let scanError = $state<string | null>(null);
	const inputId = $derived(idPrefix ? `${idPrefix}-receipt-file` : undefined);

	const verdictMeta = $derived.by(() => {
		if (!extracted) return null;
		switch (extracted.verdict) {
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

	async function handleFileChange(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		target.value = '';
		if (!file) return;

		scanError = null;
		let dataUrl: string;
		try {
			dataUrl = await readReceiptFileAsDataUrl(file);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to upload receipt.');
			return;
		}

		onExtracted(dataUrl, null);

		isExtracting = true;
		try {
			const result = await extractReceiptInfo(dataUrl);
			if (result.success) {
				onExtracted(dataUrl, result.data);
			} else {
				scanError = result.error;
			}
		} finally {
			isExtracting = false;
		}
	}
</script>

<div class="space-y-2">
	<Label for={inputId}>{label}</Label>

	<ImageUploadPreview
		{value}
		alt="Receipt preview"
		{disabled}
		isProcessing={isExtracting}
		emptyLabel="Scan a receipt"
		previewClass="max-h-40 w-full object-contain"
		onPick={() => inputRef?.click()}
		onRemove={() => {
			scanError = null;
			onRemove();
		}}
	/>

	<input
		bind:this={inputRef}
		id={inputId}
		type="file"
		accept="image/jpeg,image/png,image/webp"
		class="hidden"
		disabled={disabled || isExtracting}
		onchange={handleFileChange}
	/>

	{#if extracted}
		<div class="flex items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
			{#if verdictMeta}
				{@const Icon = verdictMeta.icon}
				<Icon class="mt-0.5 size-3.5 shrink-0 {verdictMeta.class}" aria-hidden="true" />
			{/if}
			<p class="text-muted-foreground">
				AI read:
				{#if extracted.amount}
					<span class="font-medium text-foreground">{formatCurrency(extracted.amount)}</span>
				{/if}
				{#if extracted.transactionDate}
					· {formatDateVeryShort(extracted.transactionDate)}
				{/if}
				{#if extracted.senderName}
					· from {extracted.senderName}{extracted.senderBank ? ` (${extracted.senderBank})` : ''}
				{/if}
				{#if !extracted.amount && !extracted.transactionDate && !extracted.senderName}
					{extracted.summary}
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
