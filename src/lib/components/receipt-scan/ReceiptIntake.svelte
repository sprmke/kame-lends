<script lang="ts">
	import { Loader2, Plus, Upload } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { useAiStatus } from '$lib/ai-status.svelte';
	import { MAX_PAYMENT_RECEIPTS } from '$lib/payment-receipts';
	import { RECEIPT_FILE_ACCEPT } from '$lib/receipt-image';
	import type { ReceiptScanContext } from '$lib/receipt-extraction-client';
	import {
		groupScannedReceipts,
		type ProposedTransaction
	} from '$lib/receipt-scan/group-transactions';
	import type { PartyCandidate } from '$lib/receipt-scan/match-party';
	import { scanReceiptFiles } from '$lib/receipt-scan/scan-files';
	import { toast } from '$lib/toast';

	interface Props {
		context: ReceiptScanContext;
		/** Lenders proposals can be matched to (sender for funding, receiver for repayments). */
		lenders: PartyCandidate[];
		/** Lender used when a receipt's name matches nobody (e.g. the investor card). */
		defaultInvestorId?: number | null;
		/** Loan being edited — references already on it are flagged. */
		currentLoanId?: number | null;
		/** Received payments: pre-pick an interest period for a row. */
		suggestPeriod?: (investorId: number, amount: number | null) => string;
		/** Receives one proposal per transaction, receipts attached. */
		onCreate: (proposals: ProposedTransaction[]) => void;
		variant?: 'dropzone' | 'compact';
		label?: string;
		disabled?: boolean;
		class?: string;
	}

	let {
		context,
		lenders,
		defaultInvestorId = null,
		currentLoanId = null,
		suggestPeriod,
		onCreate,
		variant = 'dropzone',
		label,
		disabled = false,
		class: className = ''
	}: Props = $props();

	const ai = useAiStatus();

	let inputRef = $state<HTMLInputElement | null>(null);
	let progress = $state<{ done: number; total: number } | null>(null);
	let dragging = $state(false);

	const busy = $derived(disabled || progress !== null);
	const text = $derived(label ?? (variant === 'compact' ? 'Add receipts' : 'Upload receipts'));

	function plural(count: number, word: string) {
		return `${count} ${word}${count === 1 ? '' : 's'}`;
	}

	async function intake(fileList: File[]) {
		let files = fileList.filter((file) => file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name));
		if (files.length === 0) return;
		if (files.length > MAX_PAYMENT_RECEIPTS) {
			toast.info(`Reading the first ${MAX_PAYMENT_RECEIPTS} receipts.`);
			files = files.slice(0, MAX_PAYMENT_RECEIPTS);
		}

		progress = { done: 0, total: files.length };
		try {
			await ai.ready();
			const useAi = ai.receiptExtraction;
			const scanned = await scanReceiptFiles(files, context, {
				skipAi: !useAi,
				onProgress: (done, total) => (progress = { done, total })
			});

			for (const item of scanned.filter((entry) => !entry.receipt)) {
				toast.error(`${item.fileName}: ${item.error ?? "Couldn't upload this image."}`);
			}
			const usable = scanned.filter((entry) => entry.receipt);
			if (usable.length === 0) return;

			const group = groupScannedReceipts(usable, {
				purpose: context.purpose,
				lenders,
				defaultInvestorId,
				currentLoanId
			});
			// `include: false` + already recorded = this exact transfer is already on this loan.
			const duplicates = group.proposals.filter(
				(proposal) =>
					!proposal.include &&
					proposal.warnings.some((warning) => warning.code === 'already_recorded')
			);
			const proposals = group.proposals
				.filter((proposal) => !duplicates.includes(proposal))
				.map((proposal) => ({
				...proposal,
				interestPeriodId:
					suggestPeriod && proposal.investorId !== null
						? suggestPeriod(
								proposal.investorId,
								proposal.amount ? Number(proposal.amount) : null
							)
						: proposal.interestPeriodId
			}));
			if (proposals.length > 0) onCreate(proposals);
			if (duplicates.length > 0) {
				toast.info(
					`${plural(duplicates.length, 'transfer')} already on this loan ${duplicates.length === 1 ? 'was' : 'were'} skipped.`
				);
			}

			if (useAi) {
				const notes = [
					`${plural(usable.length, 'receipt')} → ${plural(proposals.length, 'transaction')}.`
				];
				if (group.duplicateCount > 0) notes.push(`${plural(group.duplicateCount, 'duplicate')} skipped.`);
				if (group.failedTransferCount > 0) {
					notes.push(`${plural(group.failedTransferCount, 'failed transfer')} skipped.`);
				}
				if (group.scanErrorCount > 0) {
					notes.push(`${group.scanErrorCount} couldn't be read. Fill ${group.scanErrorCount === 1 ? 'it' : 'them'} in.`);
				}
				toast.success(notes.join(' '));
			}
		} finally {
			progress = null;
		}
	}

	function handleInput(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const files = Array.from(target.files ?? []);
		target.value = '';
		void intake(files);
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		if (busy) return;
		void intake(Array.from(event.dataTransfer?.files ?? []));
	}

	const progressText = $derived(
		progress
			? progress.done < progress.total
				? `Reading ${progress.done + 1} of ${progress.total}…`
				: 'Finishing…'
			: null
	);
</script>

{#if variant === 'compact'}
	<Button
		type="button"
		variant="outline"
		size="sm"
		class={cn('w-full', className)}
		disabled={busy}
		onclick={() => inputRef?.click()}
	>
		{#if progress}
			<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
			{progressText}
		{:else}
			<Plus class="mr-2 h-4 w-4" aria-hidden="true" />
			{text}
		{/if}
	</Button>
{:else}
	<button
		type="button"
		class={cn(
			'flex min-h-[8.75rem] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm transition-colors',
			!busy && 'hover:border-primary/40 hover:bg-muted/40',
			dragging && 'border-primary/60 bg-primary/5',
			busy && 'cursor-progress',
			disabled && 'cursor-not-allowed opacity-60',
			className
		)}
		disabled={busy}
		onclick={() => inputRef?.click()}
		ondragover={(event) => {
			event.preventDefault();
			if (!busy) dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={handleDrop}
		aria-busy={progress !== null}
	>
		<span class="flex size-10 items-center justify-center rounded-full bg-muted">
			{#if progress}
				<Loader2 class="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
			{:else}
				<Upload class="size-4 text-muted-foreground" aria-hidden="true" />
			{/if}
		</span>
		<span class="font-medium">{progressText ?? text}</span>
		{#if !progress && ai.receiptExtraction}
			<span class="text-xs text-muted-foreground">Amounts and dates fill in from each receipt</span>
		{/if}
	</button>
{/if}

<input
	bind:this={inputRef}
	type="file"
	accept={RECEIPT_FILE_ACCEPT}
	multiple
	class="hidden"
	aria-label={text}
	disabled={busy}
	onchange={handleInput}
/>
