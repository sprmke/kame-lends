<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import { createIsMobileOverlay } from '$lib/composables/use-media-query.svelte';
	import { createOverlayContentReady } from '$lib/composables/use-overlay-content-ready.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		title?: string;
		description?: string;
		srOnlyHeader?: boolean;
		showCloseButton?: boolean;
		contentClass?: string;
		bodyClass?: string;
		sheetSide?: 'bottom' | 'right';
		/**
		 * Defer the body until after the shell paints. Only for heavy trees
		 * (loan form/detail). Light dialogs must leave this off.
		 */
		deferBody?: boolean;
		children: Snippet;
		header?: Snippet;
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
		bodyClass = '',
		sheetSide = 'bottom',
		deferBody = false,
		children,
		header,
		footer
	}: Props = $props();

	const mobile = createIsMobileOverlay(
		typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
	);

	/** Lock sheet vs dialog for the lifetime of an open overlay so resize does not remount forms. */
	let presentation = $state<'sheet' | 'dialog'>(
		typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
			? 'sheet'
			: 'dialog'
	);
	let lockedOpen = $state(false);

	const overlayContent = createOverlayContentReady();

	$effect(() => mobile.init());

	$effect(() => {
		if (!deferBody) return;
		overlayContent.armWhenOpen(open);
	});

	const showBody = $derived(!deferBody || overlayContent.ready);

	$effect(() => {
		if (open) {
			if (!lockedOpen) {
				presentation = mobile.matches ? 'sheet' : 'dialog';
				lockedOpen = true;
			}
		} else {
			lockedOpen = false;
			presentation = mobile.matches ? 'sheet' : 'dialog';
		}
	});
</script>

{#if presentation === 'sheet'}
	<Sheet.Root {open} {onOpenChange}>
		<Sheet.Content
			side={sheetSide}
			{showCloseButton}
			class={cn(
				'responsive-modal-shell flex h-auto max-h-[min(90dvh,90vh)] flex-col gap-0 overflow-hidden p-0',
				contentClass
			)}
		>
			{#if header}
				<div class="min-w-0 shrink-0 border-b border-border/60 px-5 pt-6 pr-12 pb-4">
					{@render header()}
				</div>
			{:else if title || description}
				<Sheet.Header
					class={cn(srOnlyHeader && 'sr-only', 'shrink-0 border-b border-border/60 px-5 pb-4 pt-6 pr-12')}
				>
					{#if title}<Sheet.Title>{title}</Sheet.Title>{/if}
					{#if description}<Sheet.Description>{description}</Sheet.Description>{/if}
				</Sheet.Header>
			{/if}
			<div class={cn('min-h-0 overflow-y-auto px-5 py-4', bodyClass)}>
				{#if showBody}
					{@render children()}
				{:else}
					<div class="space-y-3 py-2" aria-hidden="true">
						<div class="h-4 w-2/3 rounded-md bg-muted"></div>
						<div class="h-24 rounded-xl bg-muted/60"></div>
						<div class="h-4 w-1/2 rounded-md bg-muted"></div>
					</div>
				{/if}
			</div>
			{#if footer}
				<div
					data-slot="responsive-modal-footer"
					class="sheet-modal-footer flex shrink-0 flex-col-reverse gap-3 border-t border-border/60 bg-background px-5 pt-4 pb-safe"
				>
					{@render footer()}
				</div>
			{/if}
		</Sheet.Content>
	</Sheet.Root>
{:else}
	<Dialog.Root {open} {onOpenChange}>
		<Dialog.Content
			{showCloseButton}
			class={cn(
				'responsive-modal-shell flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0',
				contentClass
			)}
		>
			{#if header}
				<div
					class={cn(
						'min-w-0 shrink-0 border-b border-border/60 px-5 pt-6 pb-4 md:px-6',
						showCloseButton && 'pr-12'
					)}
				>
					{@render header()}
				</div>
			{:else if title || description}
				<Dialog.Header
					class={cn(
						srOnlyHeader && 'sr-only',
						'shrink-0 border-b border-border/60 px-5 pb-4 pt-6 md:px-6',
						showCloseButton && 'pr-12'
					)}
				>
					{#if title}<Dialog.Title>{title}</Dialog.Title>{/if}
					{#if description}<Dialog.Description>{description}</Dialog.Description>{/if}
				</Dialog.Header>
			{/if}
			<div class={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6 md:py-5', bodyClass)}>
				{#if showBody}
					{@render children()}
				{:else}
					<div class="space-y-3 py-2" aria-hidden="true">
						<div class="h-4 w-2/3 rounded-md bg-muted"></div>
						<div class="h-24 rounded-xl bg-muted/60"></div>
						<div class="h-4 w-1/2 rounded-md bg-muted"></div>
					</div>
				{/if}
			</div>
			{#if footer}
				<div
					data-slot="responsive-modal-footer"
					class="flex shrink-0 flex-col-reverse gap-2 rounded-b-2xl border-t border-border/60 bg-muted/30 px-5 py-4 md:px-6 sm:flex-row sm:justify-end"
				>
					{@render footer()}
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Root>
{/if}
