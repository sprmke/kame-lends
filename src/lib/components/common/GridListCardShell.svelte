<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import ResponsiveOverflowMenu from '$lib/components/common/ResponsiveOverflowMenu.svelte';
	import { Button } from '$lib/components/ui/button';
	import { MoreVertical } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import type { RowActionItem } from '$lib/components/common/action-buttons';
	import {
		activateGridCard,
		handleGridCardKeydown
	} from '$lib/components/common/grid-list-card-mobile';

	interface Props {
		viewHref: string;
		actionItems?: RowActionItem[];
		onQuickView?: () => void;
		class?: string;
		headerClass?: string;
		contentClass?: string;
		/** Extra selectors for tap-ignore (e.g. loan bulk select). */
		ignoreSelectors?: string[];
		header: Snippet;
		children: Snippet;
	}

	let {
		viewHref,
		actionItems = [],
		onQuickView,
		class: className,
		headerClass,
		contentClass = 'flex-1 space-y-2 px-3 pt-0 pb-2.5',
		ignoreSelectors = [],
		header,
		children
	}: Props = $props();

	const hasMenu = $derived(actionItems.length > 0);

	function handleActivate(event: MouseEvent | KeyboardEvent) {
		activateGridCard(event, () => onQuickView?.(), ignoreSelectors);
	}

	const cardInteractive = $derived(Boolean(onQuickView));
</script>

<Card.Root
	class={cn(
		'flex h-full flex-col overflow-hidden transition-colors hover:border-primary/20',
		cardInteractive && 'cursor-pointer native-press',
		className
	)}
	role={cardInteractive ? 'button' : undefined}
	tabindex={cardInteractive ? 0 : undefined}
	onclick={handleActivate}
	onkeydown={(event) => handleGridCardKeydown(event, handleActivate)}
>
	<Card.Header class={cn('relative px-3 pt-3 pb-0', headerClass)}>
		{#if hasMenu}
			<div
				class="absolute top-3 right-3 z-10"
				data-grid-card-actions
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
				role="presentation"
			>
				<ResponsiveOverflowMenu items={actionItems} ariaLabel="More actions" sheetTitle="Actions">
					{#snippet trigger({ props })}
						<Button
							{...props}
							variant="outline"
							size="sm"
							title="More actions"
							aria-label="More actions"
							class="touch-target min-h-11 min-w-11 shrink-0 rounded-full border-border/60 px-0 shadow-none"
						>
							<MoreVertical />
						</Button>
					{/snippet}
				</ResponsiveOverflowMenu>
			</div>
		{/if}
		<div class={cn(hasMenu && 'pr-11')}>
			{@render header()}
		</div>
	</Card.Header>
	<Card.Content class={contentClass}>
		{@render children()}
	</Card.Content>
</Card.Root>
