<script lang="ts" module>
	export type Side = 'top' | 'right' | 'bottom' | 'left';
</script>

<script lang="ts">
	import { Dialog as SheetPrimitive } from 'bits-ui';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import SheetOverlay from './sheet-overlay.svelte';
	import SheetPortal from './sheet-portal.svelte';
	import type { Snippet } from 'svelte';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		side = 'right',
		showCloseButton = true,
		portalProps,
		children,
		...restProps
	}: WithoutChildrenOrChild<SheetPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof SheetPortal>>;
		side?: Side;
		showCloseButton?: boolean;
		children: Snippet;
	} = $props();
</script>

<SheetPortal {...portalProps}>
	<SheetOverlay />
	<SheetPrimitive.Content
		bind:ref
		data-slot="sheet-content"
		data-side={side}
		class={cn(
			'fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
			side === 'bottom' &&
				'inset-x-0 bottom-0 h-auto max-h-[90dvh] rounded-t-2xl border-t pb-safe data-open:slide-in-from-bottom-10 data-closed:slide-out-to-bottom-10',
			side === 'top' &&
				'inset-x-0 top-0 h-auto border-b data-open:slide-in-from-top-10 data-closed:slide-out-to-top-10',
			side === 'left' &&
				'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm data-open:slide-in-from-left-10 data-closed:slide-out-to-left-10',
			side === 'right' &&
				'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm data-open:slide-in-from-right-10 data-closed:slide-out-to-right-10',
			className
		)}
		{...restProps}
	>
		{#if side === 'bottom'}
			<div
				class="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
				aria-hidden="true"
			></div>
		{/if}
		{@render children?.()}
		{#if showCloseButton}
			<SheetPrimitive.Close data-slot="sheet-close">
				{#snippet child({ props })}
					<Button
						variant="ghost"
						class="touch-target absolute top-2 right-2"
						size="icon"
						{...props}
					>
						<XIcon />
						<span class="sr-only">Close</span>
					</Button>
				{/snippet}
			</SheetPrimitive.Close>
		{/if}
	</SheetPrimitive.Content>
</SheetPortal>
