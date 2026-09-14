<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import { imagePreviewSrc } from '$lib/storage-reference';
	import type { PaymentReceipt } from '$lib/payment-receipts';

	interface Props {
		receipts?: PaymentReceipt[];
		label?: string;
	}

	let { receipts = [], label = 'Receipts' }: Props = $props();
	let openIndex = $state<number | null>(null);

	const visible = $derived(
		receipts
			.map((receipt, index) => ({
				index,
				src: imagePreviewSrc(receipt.imageUrl)
			}))
			.filter((item): item is { index: number; src: string } => Boolean(item.src))
	);

	const openSrc = $derived(openIndex != null ? imagePreviewSrc(receipts[openIndex]?.imageUrl) : null);
</script>

{#if visible.length > 0}
	<div class="mt-3 space-y-1.5">
		<p class="text-[11px] font-medium text-muted-foreground">{label}</p>
		<div class="flex flex-wrap gap-2">
			{#each visible as item (item.index)}
				<button
					type="button"
					class="overflow-hidden rounded-md border border-border bg-muted/20"
					aria-label="View receipt {item.index + 1}"
					onclick={() => (openIndex = item.index)}
				>
					<img src={item.src} alt="" class="h-14 w-14 object-cover" />
				</button>
			{/each}
		</div>
	</div>
{/if}

{#if openSrc}
	<ResponsiveModal
		open={openIndex != null}
		onOpenChange={(open) => {
			if (!open) openIndex = null;
		}}
		title="Receipt"
		contentClass="sm:max-w-lg"
	>
		<img src={openSrc} alt="Receipt" class="max-h-[70vh] w-full rounded-md object-contain" />
	</ResponsiveModal>
{/if}
