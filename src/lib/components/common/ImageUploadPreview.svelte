<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { Trash2, Upload } from 'lucide-svelte';

	interface Props {
		value?: string | null;
		alt: string;
		disabled?: boolean;
		isProcessing?: boolean;
		emptyLabel: string;
		previewClass?: string;
		frameClass?: string;
		onPick: () => void;
		onRemove: () => void;
	}

	let {
		value = null,
		alt,
		disabled = false,
		isProcessing = false,
		emptyLabel,
		previewClass = 'max-h-48 w-full object-contain',
		frameClass = '',
		onPick,
		onRemove
	}: Props = $props();

	const busy = $derived(disabled || isProcessing);
</script>

{#if value}
	<div
		class={cn(
			'group/upload relative min-h-[5.5rem] overflow-hidden rounded-xl border border-border bg-muted/20',
			frameClass,
			busy && 'opacity-60'
		)}
	>
		<img src={value} {alt} class={cn('block w-full', previewClass)} />
		<div
			class={cn(
				'absolute inset-0 flex flex-wrap items-center justify-center gap-2 bg-background/80 px-3 transition-opacity motion-reduce:transition-none',
				isProcessing
					? 'opacity-100'
					: 'opacity-0 group-focus-within/upload:opacity-100 group-hover/upload:opacity-100 [@media(hover:none)]:opacity-100'
			)}
		>
			{#if isProcessing}
				<p class="text-sm font-medium">Processing...</p>
			{:else}
				<Button type="button" size="sm" class="min-h-11 gap-1.5" disabled={busy} onclick={onPick}>
					<Upload class="size-4" aria-hidden="true" />
					Replace
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="min-h-11 gap-1.5"
					disabled={busy}
					onclick={onRemove}
				>
					<Trash2 class="size-4" aria-hidden="true" />
					Remove
				</Button>
			{/if}
		</div>
	</div>
{:else}
	<button
		type="button"
		class={cn(
			'flex min-h-[8.75rem] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm transition-colors',
			!busy && 'hover:border-primary/40 hover:bg-muted/40',
			busy && 'cursor-not-allowed opacity-60'
		)}
		disabled={busy}
		onclick={onPick}
	>
		<span class="flex size-10 items-center justify-center rounded-full bg-muted">
			<Upload class="size-4 text-muted-foreground" aria-hidden="true" />
		</span>
		<span class="font-medium">{isProcessing ? 'Processing...' : emptyLabel}</span>
	</button>
{/if}
