<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import type { LegendGroup, ViewMode } from './types';

	interface Props {
		title: string;
		compactTitle?: string;
		viewMode: ViewMode;
		onViewModeChange: (mode: ViewMode) => void;
		onToday: () => void;
		onPrevious: () => void;
		onNext: () => void;
		showLegend?: boolean;
		legendGroups?: LegendGroup[];
	}

	let {
		title,
		compactTitle,
		viewMode,
		onViewModeChange,
		onToday,
		onPrevious,
		onNext,
		showLegend = true,
		legendGroups
	}: Props = $props();
</script>

<Card.Root>
	<Card.Content class="space-y-2.5 p-3">
		<div class="flex items-center gap-2">
			<h2 class="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight lg:text-base">
				<span class="lg:hidden">{compactTitle ?? title}</span>
				<span class="hidden lg:inline">{title}</span>
			</h2>
			<div class="flex shrink-0 items-center gap-1.5">
				<div class="hidden lg:block">
					<div class="pill-segment">
						<Button
							variant={viewMode === 'day' ? 'secondary' : 'ghost'}
							size="xs"
							onclick={() => onViewModeChange('day')}
							class="h-7 px-2.5 shadow-none"
							aria-pressed={viewMode === 'day'}
						>
							Day
						</Button>
						<Button
							variant={viewMode === 'week' ? 'secondary' : 'ghost'}
							size="xs"
							onclick={() => onViewModeChange('week')}
							class="h-7 px-2.5 shadow-none"
							aria-pressed={viewMode === 'week'}
						>
							Week
						</Button>
						<Button
							variant={viewMode === 'month' ? 'secondary' : 'ghost'}
							size="xs"
							onclick={() => onViewModeChange('month')}
							class="h-7 px-2.5 shadow-none"
							aria-pressed={viewMode === 'month'}
						>
							Month
						</Button>
					</div>
				</div>
				<div class="pill-segment gap-0.5 p-0.5">
					<Button
						variant="ghost"
						size="xs"
						onclick={onToday}
						class="touch-hit h-7 px-2.5 shadow-none"
					>
						Today
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						aria-label="Previous"
						onclick={onPrevious}
						class="touch-hit shadow-none"
					>
						<ChevronLeft />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						aria-label="Next"
						onclick={onNext}
						class="touch-hit shadow-none"
					>
						<ChevronRight />
					</Button>
				</div>
			</div>
		</div>

		{#if showLegend && legendGroups && legendGroups.length > 0}
			<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium lg:text-xs">
				{#each legendGroups as group, groupIndex (group.title)}
					<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
						{#if groupIndex > 0}
							<span class="hidden h-3 w-px bg-border lg:inline-block"></span>
						{/if}
						<span class="hidden text-muted-foreground lg:inline">{group.title}</span>
						{#each group.items as item (item.label)}
							<div class="flex items-center gap-1">
								<div class="size-2 shrink-0 rounded-full {item.color}"></div>
								<span>{item.label}</span>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		{/if}
	</Card.Content>
</Card.Root>
