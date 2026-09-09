<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import { createIsMobileOverlay } from '$lib/composables/use-media-query.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		title?: string;
		description?: string;
		srOnlyHeader?: boolean;
		showCloseButton?: boolean;
		contentClass?: string;
		sheetSide?: 'bottom' | 'right';
		children: Snippet;
		footer?: Snippet;
	}

	let {
		open,
		onOpenChange,
		title,
		description,
		srOnlyHeader = false,
		showCloseButton = true,
		contentClass = '',
		sheetSide = 'bottom',
		children,
		footer
	}: Props = $props();

	const mobile = createIsMobileOverlay(false);
	$effect(() => mobile.init());
</script>

{#if mobile.matches}
	<Sheet.Root {open} {onOpenChange}>
		<Sheet.Content
			side={sheetSide}
			{showCloseButton}
			class={cn('gap-0 overflow-hidden p-0', contentClass)}
		>
			{#if title || description}
				<Sheet.Header class={cn(srOnlyHeader && 'sr-only', 'shrink-0 border-b border-border/60')}>
					{#if title}<Sheet.Title>{title}</Sheet.Title>{/if}
					{#if description}<Sheet.Description>{description}</Sheet.Description>{/if}
				</Sheet.Header>
			{/if}
			<div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
				{@render children()}
			</div>
			{#if footer}
				<Sheet.Footer class="shrink-0">
					{@render footer()}
				</Sheet.Footer>
			{/if}
		</Sheet.Content>
	</Sheet.Root>
{:else}
	<Dialog.Root {open} {onOpenChange}>
		<Dialog.Content {showCloseButton} class={cn('max-h-[90vh] overflow-y-auto', contentClass)}>
			{#if title || description}
				<Dialog.Header class={cn(srOnlyHeader && 'sr-only')}>
					{#if title}<Dialog.Title>{title}</Dialog.Title>{/if}
					{#if description}<Dialog.Description>{description}</Dialog.Description>{/if}
				</Dialog.Header>
			{/if}
			{@render children()}
			{#if footer}
				<Dialog.Footer>
					{@render footer()}
				</Dialog.Footer>
			{/if}
		</Dialog.Content>
	</Dialog.Root>
{/if}
