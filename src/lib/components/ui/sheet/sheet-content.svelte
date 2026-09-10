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
			'fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg',
			side === 'bottom' &&
				'inset-x-0 bottom-0 h-auto max-h-[min(92dvh,100%)] overflow-hidden rounded-t-2xl border-t pb-safe',
			side === 'top' && 'inset-x-0 top-0 h-auto border-b',
			side === 'left' && 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
			side === 'right' && 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
			className
		)}
		{...restProps}
	>
		{#if side === 'bottom'}
			<div class="flex shrink-0 justify-center pt-3 pb-2.5" aria-hidden="true">
				<div class="h-1 w-10 rounded-full bg-muted-foreground/35"></div>
			</div>
		{/if}
		{@render children?.()}
		{#if showCloseButton}
			<SheetPrimitive.Close data-slot="sheet-close">
				{#snippet child({ props })}
					<Button
						variant="ghost"
						class="touch-target absolute top-3 right-3"
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
