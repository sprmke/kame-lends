<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { cn } from '$lib/utils';
	import { formatCount } from '$lib/format';

	interface Props {
		title: string;
		count?: number;
		// Lucide icon components (legacy constructor shape)
		icon: any;
		accentClassName: string;
		iconClassName: string;
		onViewAllClick?: () => void;
		children: Snippet;
		class?: string;
	}

	let {
		title,
		count = 0,
		icon: Icon,
		accentClassName,
		iconClassName,
		onViewAllClick,
		children,
		class: className
	}: Props = $props();
</script>

<Card.Root class={cn('flex h-full flex-col overflow-hidden border-border/60', className)}>
	<Card.Header class="space-y-0 pb-2">
		<div class="flex items-center justify-between gap-2">
			<div class="min-w-0">
				<div class="flex min-w-0 items-center gap-2">
					<Card.Title class="text-sm leading-snug font-medium">{title}</Card.Title>
					{#if count > 0}
						<button
							type="button"
							onclick={onViewAllClick}
							class={cn(
								'touch-hit rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors',
								onViewAllClick && 'cursor-pointer hover:bg-primary/10 hover:text-primary'
							)}
							title={`View all ${title.toLowerCase()}`}
						>
							{formatCount(count)}
						</button>
					{/if}
				</div>
			</div>
			<div class={cn('icon-well-xs', accentClassName)}>
				<Icon class={cn('h-3 w-3', iconClassName)} />
			</div>
		</div>
	</Card.Header>
	<Card.Content class="min-w-0 flex-1">
		{@render children()}
	</Card.Content>
</Card.Root>
