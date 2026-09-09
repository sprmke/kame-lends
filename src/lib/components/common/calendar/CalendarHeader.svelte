<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import type { LegendGroup, ViewMode } from './types';

	interface Props {
		title: string;
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
	<Card.Content class="p-3">
		<div class="flex flex-col gap-3">
			<div class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
				<h2 class="text-base font-semibold tracking-tight">{title}</h2>
				<div
					class="flex flex-col-reverse items-start gap-2 sm:items-end xl:flex-row xl:items-center"
				>
					{#if showLegend && legendGroups && legendGroups.length > 0}
						<div
							class="flex flex-wrap items-center rounded-md border border-border/60 px-2 py-1 text-xs"
						>
							{#each legendGroups as group, groupIndex (group.title)}
								<div class="flex items-center">
									{#if groupIndex > 0}
										<div class="mx-2 inline-block h-4 w-px bg-gray-300 md:mx-4 md:h-6"></div>
									{/if}
									<div class="inline-flex items-center gap-1 md:gap-2">
										<span class="hidden font-semibold text-gray-600 sm:inline">{group.title}:</span>
										{#each group.items as item (item.label)}
											<div class="flex items-center gap-1 md:gap-1.5">
												<div
													class="flex h-2 w-2 items-center justify-center rounded-full md:h-3 md:w-3 {item.color}"
												></div>
												<span class="text-[10px] font-medium md:text-xs">{item.label}</span>
											</div>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/if}
					<div class="flex flex-col items-center justify-center gap-2 sm:flex-row sm:justify-end">
						<div class="flex items-center rounded-md border p-0.5">
							<Button
								variant={viewMode === 'day' ? 'secondary' : 'ghost'}
								size="sm"
								onclick={() => onViewModeChange('day')}
								class="h-7 px-2 text-xs"
							>
								Day
							</Button>
							<Button
								variant={viewMode === 'week' ? 'secondary' : 'ghost'}
								size="sm"
								onclick={() => onViewModeChange('week')}
								class="h-7 px-2 text-xs"
							>
								Week
							</Button>
							<Button
								variant={viewMode === 'month' ? 'secondary' : 'ghost'}
								size="sm"
								onclick={() => onViewModeChange('month')}
								class="h-7 px-2 text-xs"
							>
								Month
							</Button>
						</div>
						<div class="flex items-center gap-2">
							<Button variant="outline" size="sm" onclick={onToday}>Today</Button>
							<Button variant="outline" size="sm" onclick={onPrevious}>
								<ChevronLeft class="h-4 w-4" />
							</Button>
							<Button variant="outline" size="sm" onclick={onNext}>
								<ChevronRight class="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</Card.Content>
</Card.Root>
