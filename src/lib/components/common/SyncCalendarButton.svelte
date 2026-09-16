<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Sheet from '$lib/components/ui/sheet';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import { toast } from '$lib/toast';
	import { createIsMobileShell } from '$lib/composables/use-media-query.svelte';
	import { formatToMMDDYYYY } from '$lib/date-utils';
	import type { CalendarSyncScope, PlannedLoanSync } from '$lib/calendar-sync-plan';
	import { Calendar, Loader2, RefreshCw, Trash2, ChevronDown } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	interface Props {
		variant?: 'default' | 'outline' | 'ghost' | 'secondary';
		size?: 'default' | 'sm' | 'lg' | 'icon';
		/** Batched sync endpoint (`prepare` / `wipe` / `loans` / `summaries`). */
		syncEndpoint: string;
		/** Optional clear-only endpoint. When omitted, Clear uses wipe on syncEndpoint. */
		cleanupEndpoint?: string | null;
		showClear?: boolean;
		label?: string;
		triggerClass?: string;
	}

	let {
		variant = 'outline',
		size = 'default',
		syncEndpoint,
		cleanupEndpoint = null,
		showClear = true,
		label = 'Calendar',
		triggerClass
	}: Props = $props();

	const triggerButtonClass = $derived(cn('touch-target', triggerClass));

	type ModalMode = 'idle' | 'choose' | 'sync' | 'clear';
	type SyncPhase = 'clearing' | 'loans' | 'summaries' | 'done';

	let sheetOpen = $state(false);
	let modalMode = $state<ModalMode>('idle');
	let scope = $state<CalendarSyncScope>('open');
	let running = $state(false);
	let cancelled = $state(false);
	let phase = $state<SyncPhase>('clearing');
	let statusLine = $state('');
	let currentDates = $state<string[]>([]);
	let currentLoanName = $state('');
	let clearedCount = $state(0);
	let loansDone = $state(0);
	let loansTotal = $state(0);
	let eventsCreated = $state(0);
	let summariesDone = $state(0);
	let summariesTotal = $state(0);
	let percent = $state(0);

	const isMobileShell = createIsMobileShell(false);
	const modalOpen = $derived(modalMode !== 'idle');
	const title = $derived(
		modalMode === 'clear' ? 'Clear calendar' : modalMode === 'sync' ? 'Syncing calendar' : 'Sync calendar'
	);

	$effect(() => isMobileShell.init());

	function openChoose() {
		sheetOpen = false;
		scope = 'open';
		modalMode = 'choose';
	}

	function openClear() {
		sheetOpen = false;
		void handleClear();
	}

	function closeModal(open: boolean) {
		if (running) return;
		if (!open) modalMode = 'idle';
	}

	function resetProgress() {
		cancelled = false;
		phase = 'clearing';
		statusLine = '';
		currentDates = [];
		currentLoanName = '';
		clearedCount = 0;
		loansDone = 0;
		loansTotal = 0;
		eventsCreated = 0;
		summariesDone = 0;
		summariesTotal = 0;
		percent = 0;
	}

	async function postJson(url: string, body?: Record<string, unknown>) {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: body ? JSON.stringify(body) : undefined
		});
		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			throw new Error(
				(typeof data.details === 'string' && data.details) ||
					(typeof data.error === 'string' && data.error) ||
					`HTTP ${response.status}`
			);
		}
		return data;
	}

	async function wipeLoop() {
		phase = 'clearing';
		statusLine = 'Clearing calendar';
		currentDates = [];
		currentLoanName = '';
		let offset = 0;
		while (!cancelled) {
			const data = await postJson(syncEndpoint, { action: 'wipe', offset });
			clearedCount += Number(data.deleted ?? 0);
			statusLine = `Cleared ${clearedCount} events`;
			percent = Math.min(12, 4 + Math.floor(clearedCount / 8));
			offset = Number(data.nextOffset ?? offset);
			if (!data.remaining) break;
		}
	}

	async function handleSync() {
		running = true;
		cancelled = false;
		resetProgress();
		modalMode = 'sync';
		try {
			const plan = await postJson(syncEndpoint, { action: 'prepare', scope });
			const loanPlans = (plan.loans ?? []) as PlannedLoanSync[];
			loansTotal = Number(plan.loanCount ?? loanPlans.length);
			summariesTotal = Number(plan.summaryCount ?? 0);
			statusLine =
				scope === 'open' ? 'Open loans' : scope === 'upcoming' ? 'Today and later' : 'All dates';

			await wipeLoop();
			if (cancelled) return;

			phase = 'loans';
			percent = 12;
			let offset = 0;
			while (!cancelled) {
				const data = await postJson(syncEndpoint, {
					action: 'loans',
					scope,
					offset
				});
				const results = (data.results ?? []) as Array<{
					loanName?: string;
					eventCount?: number;
					dates?: string[];
				}>;
				const result = results[0];
				if (result) {
					currentLoanName = result.loanName ?? '';
					currentDates = result.dates ?? [];
					eventsCreated += Number(result.eventCount ?? 0);
					statusLine = currentLoanName;
				}
				offset = Number(data.nextOffset ?? offset + 1);
				loansDone = Math.min(offset, loansTotal);
				percent = loansTotal
					? 12 + Math.round((loansDone / loansTotal) * 70)
					: 82;
				if (data.done) break;
			}
			if (cancelled) return;

			phase = 'summaries';
			currentLoanName = '';
			offset = 0;
			while (!cancelled) {
				const data = await postJson(syncEndpoint, {
					action: 'summaries',
					scope,
					offset
				});
				currentDates = (data.dates ?? []) as string[];
				statusLine = 'Totals';
				offset = Number(data.nextOffset ?? offset + currentDates.length);
				summariesDone = Math.min(offset, summariesTotal);
				percent = summariesTotal
					? 82 + Math.round((summariesDone / summariesTotal) * 18)
					: 100;
				if (data.done || summariesTotal === 0) break;
			}
			if (cancelled) return;

			phase = 'done';
			percent = 100;
			statusLine = 'Done';
			currentDates = [];
			toast.success(`Calendar synced. ${eventsCreated} events, ${loansDone} loans.`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to sync calendar');
		} finally {
			running = false;
			if (cancelled) modalMode = 'idle';
		}
	}

	async function handleClear() {
		running = true;
		cancelled = false;
		resetProgress();
		modalMode = 'clear';
		statusLine = 'Clearing calendar';
		try {
			if (cleanupEndpoint) {
				while (!cancelled) {
					const data = await postJson(cleanupEndpoint);
					clearedCount += Number(data.deleted ?? data.deletedCount ?? 0);
					statusLine = `Cleared ${clearedCount} events`;
					percent = data.remaining ? Math.min(90, 8 + Math.floor(clearedCount / 5)) : 100;
					if (!data.remaining) break;
				}
			} else {
				await wipeLoop();
			}
			if (cancelled) return;
			phase = 'done';
			percent = 100;
			statusLine =
				clearedCount === 0 ? 'Calendar already empty' : `Cleared ${clearedCount} events`;
			toast.success(statusLine);
		} catch (error) {
			statusLine = error instanceof Error ? error.message : 'Failed to clear calendar';
			toast.error(statusLine);
		} finally {
			running = false;
			if (cancelled) modalMode = 'idle';
		}
	}

	function stopRun() {
		cancelled = true;
		statusLine = 'Stopping';
	}
</script>

{#if isMobileShell.matches}
	<Button
		{variant}
		{size}
		disabled={running}
		class={triggerButtonClass}
		adaptToMobileHero={!triggerClass}
		aria-label={label}
		onclick={() => (sheetOpen = true)}
	>
		{#if running}
			<Loader2 class="h-4 w-4 animate-spin" />
		{:else}
			<Calendar class="h-4 w-4" />
		{/if}
		{#if triggerClass}
			<span>{label}</span>
		{/if}
	</Button>

	<Sheet.Root open={sheetOpen} onOpenChange={(open) => (sheetOpen = open)}>
		<Sheet.Content side="bottom" class="h-auto gap-0 p-0">
			<Sheet.Header class="border-b border-border/60 px-4 py-3">
				<Sheet.Title class="text-sm font-semibold">{label}</Sheet.Title>
			</Sheet.Header>

			<div class="flex flex-col gap-0.5 px-2 py-2 pb-[max(0.5rem,var(--safe-area-bottom))]">
				<button
					type="button"
					class="native-press flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
					disabled={running}
					onclick={openChoose}
				>
					<RefreshCw class="size-4 shrink-0" strokeWidth={1.75} />
					Sync calendar
				</button>
				{#if showClear}
					<button
						type="button"
						class="native-press flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/5"
						disabled={running}
						onclick={openClear}
					>
						<Trash2 class="size-4 shrink-0" strokeWidth={1.75} />
						Clear events
					</button>
				{/if}
			</div>
		</Sheet.Content>
	</Sheet.Root>
{:else}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					{variant}
					{size}
					disabled={running}
					class={triggerButtonClass}
					adaptToMobileHero={!triggerClass}
					aria-label={label}
				>
					{#if running}
						<Loader2 class="h-4 w-4 animate-spin" />
					{:else}
						<Calendar class="h-4 w-4" />
					{/if}
					{#if triggerClass}
						<span>{label}</span>
					{:else}
						<span class="hidden xl:inline">{label}</span>
						<ChevronDown class="hidden h-3.5 w-3.5 opacity-60 xl:inline" />
					{/if}
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item onclick={openChoose}>
				<RefreshCw class="h-4 w-4" />
				Sync calendar
			</DropdownMenu.Item>
			{#if showClear}
				<DropdownMenu.Item onclick={openClear} class="text-destructive">
					<Trash2 class="h-4 w-4" />
					Clear events
				</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}

<ResponsiveModal
	open={modalOpen}
	onOpenChange={closeModal}
	{title}
	showCloseButton={!running}
	contentClass="max-w-md"
>
	{#snippet header()}
		<div class="space-y-1">
			<p class="text-base font-medium">{title}</p>
			{#if modalMode === 'choose'}
				<p class="text-sm text-muted-foreground">Push loan dates to Google Calendar.</p>
			{/if}
		</div>
	{/snippet}

	{#if modalMode === 'choose'}
		<div class="grid gap-2">
			<button
				type="button"
				class="flex min-h-11 items-center justify-between rounded-2xl border px-4 text-sm font-medium {scope ===
				'all'
					? 'border-primary bg-primary/5'
					: 'border-border/60'}"
				onclick={() => (scope = 'all')}
			>
				All dates
			</button>
			<button
				type="button"
				class="flex min-h-11 items-center justify-between rounded-2xl border px-4 text-sm font-medium {scope ===
				'open'
					? 'border-primary bg-primary/5'
					: 'border-border/60'}"
				onclick={() => (scope = 'open')}
			>
				Open loans
			</button>
			<button
				type="button"
				class="flex min-h-11 items-center justify-between rounded-2xl border px-4 text-sm font-medium {scope ===
				'upcoming'
					? 'border-primary bg-primary/5'
					: 'border-border/60'}"
				onclick={() => (scope = 'upcoming')}
			>
				Today and later
			</button>
		</div>
	{:else}
		<div class="space-y-4" aria-live="polite">
			<div class="h-2 overflow-hidden rounded-full bg-muted">
				<div class="h-full rounded-full bg-primary transition-[width] duration-300" style={`width: ${percent}%`}></div>
			</div>
			<div class="space-y-1 text-sm">
				<p class="font-medium">{statusLine || 'Starting'}</p>
				{#if modalMode === 'sync' && phase === 'loans' && loansTotal}
					<p class="text-muted-foreground">Loan {loansDone} of {loansTotal}</p>
				{/if}
				{#if modalMode === 'sync' && phase === 'summaries' && summariesTotal}
					<p class="text-muted-foreground">Totals {summariesDone} of {summariesTotal}</p>
				{/if}
				{#if eventsCreated > 0}
					<p class="text-muted-foreground">{eventsCreated} events</p>
				{/if}
			</div>
			{#if currentDates.length > 0}
				<div class="flex flex-wrap gap-1.5">
					{#each currentDates as dateKey (dateKey)}
						<span class="rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums">
							{formatToMMDDYYYY(dateKey)}
						</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		{#if modalMode === 'choose'}
			<Button variant="outline" onclick={() => (modalMode = 'idle')}>Cancel</Button>
			<Button onclick={handleSync}>Sync</Button>
		{:else if running}
			<Button variant="outline" onclick={stopRun}>Stop</Button>
		{:else}
			<Button onclick={() => (modalMode = 'idle')}>Close</Button>
		{/if}
	{/snippet}
</ResponsiveModal>
