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
		stripeClassName?: string;
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
		stripeClassName = 'bg-primary',
		onViewAllClick,
		children,
		class: className
	}: Props = $props();
</script>

<Card.Root class={cn('relative flex h-full flex-col overflow-hidden border-border/60', className)}>
	<div class={cn('dashboard-panel-stripe', stripeClassName)}></div>
	<Card.Header class="space-y-0 px-3 pt-4 pb-1.5">
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0">
				<div class="flex min-w-0 items-center gap-1.5">
					<Card.Title class="text-sm leading-tight font-medium">{title}</Card.Title>
					{#if count > 0}
						<button
							type="button"
							onclick={onViewAllClick}
							class={cn(
								'rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground transition-colors',
								onViewAllClick && 'cursor-pointer hover:bg-primary/10 hover:text-primary'
							)}
							title={`View all ${title.toLowerCase()}`}
						>
							{formatCount(count)}
						</button>
					{/if}
				</div>
			</div>
			<div class={cn('icon-well-sm', accentClassName)}>
				<Icon class={cn('h-3.5 w-3.5', iconClassName)} />
			</div>
		</div>
	</Card.Header>
	<Card.Content class="min-w-0 flex-1 px-3 pt-0 pb-3">
		{@render children()}
	</Card.Content>
</Card.Root>
