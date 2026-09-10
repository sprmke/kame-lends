<script lang="ts">
	import { Check, CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Popover from '$lib/components/ui/popover';
	import * as Sheet from '$lib/components/ui/sheet';
	import { createIsMobileShell } from '$lib/composables/use-media-query.svelte';
	import {
		type DatePreset,
		type DateRange,
		formatDateRangeDisplay,
		isCurrentPeriod,
		toIsoDate
	} from '$lib/date/navigation';
	import { cn } from '$lib/utils';

	const PRESET_OPTIONS: { value: DatePreset; label: string; description: string }[] = [
		{ value: 'week', label: 'Week', description: 'Sun-Sat' },
		{ value: 'month', label: 'Month', description: 'Calendar month' },
		{ value: 'year', label: 'Year', description: 'Calendar year' },
		{ value: 'all-time', label: 'All-time', description: 'From the beginning' },
		{ value: 'custom', label: 'Custom', description: 'Pick a range' }
	];

	interface Props {
		dateRange: DateRange;
		datePreset: DatePreset;
		isActive: boolean;
		fullWidth?: boolean;
		setDatePreset: (preset: DatePreset) => void;
		setDateRange: (range: DateRange) => void;
		navigatePeriod: (direction: 'prev' | 'next') => void;
		goToToday: () => void;
		onClear: () => void;
	}

	let {
		dateRange,
		datePreset,
		isActive,
		fullWidth = false,
		setDatePreset,
		setDateRange,
		navigatePeriod,
		goToToday,
		onClear
	}: Props = $props();

	const isMobileShell = createIsMobileShell(false);
	$effect(() => isMobileShell.init());

	let presetOpen = $state(false);
	let customOpen = $state(false);
	let localFrom = $state('');
	let localTo = $state('');

	const isCurrent = $derived(isCurrentPeriod(dateRange.from, datePreset));
	const canNavigate = $derived(
		datePreset !== 'custom' && datePreset !== 'all-time' && isActive
	);
	const isCustomMode = $derived(datePreset === 'custom');
	const triggerLabel = $derived(formatDateRangeDisplay(dateRange.from, dateRange.to, datePreset));
	const triggerActive = $derived(isActive || presetOpen || customOpen);

	function handlePresetChange(preset: DatePreset) {
		if (preset === 'custom') {
			presetOpen = false;
			localFrom = toIsoDate(dateRange.from);
			localTo = toIsoDate(dateRange.to);
			customOpen = true;
			return;
		}
		setDatePreset(preset);
		presetOpen = false;
	}

	function handleApplyCustomRange() {
		if (!localFrom || !localTo) return;
		const [fy, fm, fd] = localFrom.split('-').map(Number);
		const [ty, tm, td] = localTo.split('-').map(Number);
		const from = new Date(fy, fm - 1, fd);
		const to = new Date(ty, tm - 1, td);
		if (from.getTime() > to.getTime()) return;
		setDateRange({ from, to });
		customOpen = false;
	}

	function openPresetPicker() {
		if (isCustomMode && isActive) {
			localFrom = toIsoDate(dateRange.from);
			localTo = toIsoDate(dateRange.to);
			customOpen = true;
			return;
		}
		presetOpen = true;
	}
</script>

<div class={cn('relative min-w-0', fullWidth ? 'w-full' : 'shrink-0')}>
	<div class={cn('flex items-center', fullWidth ? 'w-full' : '')}>
		{#if canNavigate}
			<Button
				variant="outline"
				size="sm"
				class="rounded-r-none border-r-0 px-2.5"
				aria-label="Previous period"
				onclick={() => navigatePeriod('prev')}
			>
				<ChevronLeft class="h-4 w-4" />
			</Button>
		{/if}

		{#if isMobileShell.matches}
			<Button
				variant={triggerActive ? 'secondary' : 'outline'}
				size="sm"
				class={cn(
					'min-w-0 gap-1.5',
					canNavigate ? 'rounded-none border-x-0' : '',
					!canNavigate && 'rounded-md',
					fullWidth ? 'flex-1 justify-center' : 'max-w-[14rem]'
				)}
				aria-expanded={presetOpen || customOpen}
				onclick={openPresetPicker}
			>
				<CalendarDays class="h-4 w-4 shrink-0" />
				<span class="truncate">{triggerLabel}</span>
				<ChevronDown
					class={cn('h-4 w-4 shrink-0 transition-transform', (presetOpen || customOpen) && 'rotate-180')}
				/>
			</Button>
		{:else}
			<Popover.Root bind:open={presetOpen}>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant={triggerActive ? 'secondary' : 'outline'}
							size="sm"
							class={cn(
								'min-w-0 gap-1.5',
								canNavigate ? 'rounded-none border-x-0' : '',
								!canNavigate && 'rounded-md',
								fullWidth ? 'w-full justify-center' : 'max-w-[12rem]'
							)}
						>
							<CalendarDays class="h-4 w-4 shrink-0" />
							<span class="truncate">{triggerLabel}</span>
							<ChevronDown
								class={cn(
									'h-4 w-4 shrink-0 transition-transform',
									presetOpen && 'rotate-180'
								)}
							/>
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-72 p-0" align="end">
					<div class="border-b border-border/60 px-3.5 py-2.5">
						<div class="flex items-center justify-between gap-2">
							<span class="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
								View by
							</span>
							{#if isActive && !isCurrent && datePreset !== 'custom' && datePreset !== 'all-time'}
								<button
									type="button"
									class="text-xs font-semibold text-primary"
									onclick={() => {
										goToToday();
										presetOpen = false;
									}}
								>
									Today
								</button>
							{/if}
						</div>
					</div>
					<div class="py-1">
						{#each PRESET_OPTIONS as opt}
							{@const selected = opt.value === datePreset}
							<button
								type="button"
								class={cn(
									'flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors',
									selected ? 'bg-muted/50' : 'hover:bg-muted/50'
								)}
								onclick={() => handlePresetChange(opt.value)}
							>
								<div class="min-w-0 flex-1">
									<p class={cn('text-[13px] leading-tight', selected ? 'font-semibold' : 'font-medium')}>
										{opt.label}
									</p>
									<p class="mt-0.5 text-[11px] leading-tight text-muted-foreground">
										{opt.description}
									</p>
								</div>
								{#if selected}
									<Check class="h-3.5 w-3.5 shrink-0 text-primary" />
								{/if}
							</button>
						{/each}
					</div>
					{#if isActive}
						<div class="flex justify-end border-t border-border/60 px-3.5 py-2">
							<button
								type="button"
								class="text-xs font-semibold text-muted-foreground hover:text-foreground"
								onclick={() => {
									onClear();
									presetOpen = false;
								}}
							>
								Clear
							</button>
						</div>
					{/if}
				</Popover.Content>
			</Popover.Root>

			<Popover.Root bind:open={customOpen}>
				<Popover.Trigger class="sr-only">
					<span>Custom range</span>
				</Popover.Trigger>
				<Popover.Content class="w-80 p-0" align="end">
					<div class="border-b border-border/60 px-3.5 py-2.5">
						<span class="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
							Custom range
						</span>
					</div>
					<div class="space-y-3 p-3.5">
						<div class="space-y-1.5">
							<label for="date-range-from" class="text-xs font-medium text-muted-foreground">From</label>
							<Input id="date-range-from" type="date" bind:value={localFrom} class="h-10" />
						</div>
						<div class="space-y-1.5">
							<label for="date-range-to" class="text-xs font-medium text-muted-foreground">To</label>
							<Input id="date-range-to" type="date" bind:value={localTo} class="h-10" />
						</div>
					</div>
					<div class="flex justify-end gap-2 border-t border-border/60 px-3.5 py-2.5">
						<Button
							variant="outline"
							size="sm"
							onclick={() => {
								setDatePreset('month');
								customOpen = false;
							}}
						>
							Presets
						</Button>
						<Button size="sm" disabled={!localFrom || !localTo} onclick={handleApplyCustomRange}>
							Apply
						</Button>
					</div>
				</Popover.Content>
			</Popover.Root>
		{/if}

		{#if canNavigate}
			<Button
				variant="outline"
				size="sm"
				class="rounded-l-none border-l-0 px-2.5"
				aria-label="Next period"
				onclick={() => navigatePeriod('next')}
			>
				<ChevronRight class="h-4 w-4" />
			</Button>
		{/if}
	</div>
</div>

{#if isMobileShell.matches}
	<Sheet.Root bind:open={presetOpen}>
		<Sheet.Content side="bottom" class="rounded-t-2xl">
			<Sheet.Header>
				<Sheet.Title>View by</Sheet.Title>
			</Sheet.Header>
			<div class="space-y-1 py-2">
				{#each PRESET_OPTIONS as opt}
					{@const selected = opt.value === datePreset}
					<button
						type="button"
						class={cn(
							'flex w-full min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-left',
							selected ? 'bg-muted/60' : 'hover:bg-muted/40'
						)}
						onclick={() => handlePresetChange(opt.value)}
					>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-semibold">{opt.label}</p>
							<p class="text-xs text-muted-foreground">{opt.description}</p>
						</div>
						{#if selected}
							<Check class="h-4 w-4 shrink-0 text-primary" />
						{/if}
					</button>
				{/each}
			</div>
			{#if isActive}
				<Sheet.Footer class="flex-row gap-2">
					{#if !isCurrent && datePreset !== 'custom' && datePreset !== 'all-time'}
						<Button variant="outline" class="flex-1" onclick={() => { goToToday(); presetOpen = false; }}>
							Today
						</Button>
					{/if}
					<Button variant="ghost" class="flex-1" onclick={() => { onClear(); presetOpen = false; }}>
						Clear
					</Button>
				</Sheet.Footer>
			{/if}
		</Sheet.Content>
	</Sheet.Root>

	<Sheet.Root bind:open={customOpen}>
		<Sheet.Content side="bottom" class="rounded-t-2xl">
			<Sheet.Header>
				<Sheet.Title>Custom range</Sheet.Title>
			</Sheet.Header>
			<div class="space-y-3 py-2">
				<div class="space-y-1.5">
					<label for="mobile-date-range-from" class="text-xs font-medium text-muted-foreground">From</label>
					<Input id="mobile-date-range-from" type="date" bind:value={localFrom} class="h-11" />
				</div>
				<div class="space-y-1.5">
					<label for="mobile-date-range-to" class="text-xs font-medium text-muted-foreground">To</label>
					<Input id="mobile-date-range-to" type="date" bind:value={localTo} class="h-11" />
				</div>
			</div>
			<Sheet.Footer class="flex-row gap-2">
				<Button
					variant="outline"
					class="flex-1"
					onclick={() => {
						presetOpen = true;
						customOpen = false;
					}}
				>
					Presets
				</Button>
				<Button class="flex-1" disabled={!localFrom || !localTo} onclick={handleApplyCustomRange}>
					Apply
				</Button>
			</Sheet.Footer>
		</Sheet.Content>
	</Sheet.Root>
{/if}
