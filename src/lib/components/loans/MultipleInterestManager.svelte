<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Tabs from '$lib/components/ui/tabs';
	import { formatCurrency, formatPercentage } from '$lib/format';
	import { isMoreThanOneMonthAndFifteenDays } from '$lib/date-utils';
	import { Plus, X } from 'lucide-svelte';
	import type { InterestPeriodData } from './multiple-interest-types';
	import { formScheduleInterest } from '$lib/loans/form-to-ledger';
	import { hasDuplicateInterestDueDates } from './multiple-interest-types';
	import {
		interestEditorReducer,
		type EditorState
	} from '$lib/loans/interest-period-editor';

	interface Props {
		sentDate: string;
		loanDueDate: string;
		amount: string;
		defaultInterestRate: string;
		defaultInterestType: 'rate' | 'fixed';
		/** Controlled periods. The parent owns this array. */
		periods: InterestPeriodData[];
		mode: 'single' | 'multiple';
		/** Existing loans keep their saved schedule; new loans auto-generate. */
		isEditing?: boolean;
		onPeriodsChange: (periods: InterestPeriodData[]) => void;
		onModeChange: (mode: 'single' | 'multiple') => void;
	}

	let {
		sentDate,
		loanDueDate,
		amount,
		defaultInterestRate,
		defaultInterestType,
		periods,
		mode,
		isEditing = false,
		onPeriodsChange,
		onModeChange
	}: Props = $props();

	/**
	 * The parent is the only source of truth. This flag only records whether
	 * the user edited the schedule by hand, so a later date change knows
	 * whether it may regenerate.
	 */
	let touched = $state(isEditing);
	/** Paid periods are locked until the user confirms the impact. */
	let unlockedPeriodIds = $state<Set<string>>(new Set());

	function isPaidPeriod(period: InterestPeriodData): boolean {
		return period.status === 'Completed' || period.status === 'Incomplete';
	}

	function isLocked(period: InterestPeriodData): boolean {
		return isPaidPeriod(period) && !unlockedPeriodIds.has(period.id);
	}

	function unlockPeriod(period: InterestPeriodData) {
		if (
			!window.confirm(
				'This period already has recorded payments. Changing the rate or date will recompute its status from those payments. Continue?'
			)
		) {
			return;
		}
		unlockedPeriodIds = new Set([...unlockedPeriodIds, period.id]);
	}

	const editorState = $derived<EditorState>({
		mode,
		periods,
		touched
	});

	function dispatch(
		action: Parameters<typeof interestEditorReducer>[1]
	) {
		const next = interestEditorReducer(editorState, action);
		if (action.type !== 'regenerateIfUntouched') touched = next.touched;
		if (next.periods !== periods) onPeriodsChange(next.periods);
		if (next.mode !== mode) onModeChange(next.mode);
	}

	// New loans: keep the intermediate periods in step with sent/due dates
	// until the user edits the schedule.
	$effect(() => {
		if (isEditing || touched || mode !== 'multiple') return;
		if (!sentDate || !loanDueDate) return;
		const next = interestEditorReducer(editorState, {
			type: 'regenerateIfUntouched',
			sentDate,
			dueDate: loanDueDate,
			defaultRate: defaultInterestRate,
			defaultType: defaultInterestType
		});
		if (next.periods === periods) return;
		const before = periods.map((row) => row.dueDate).join('|');
		const after = next.periods.map((row) => row.dueDate).join('|');
		if (before !== after) onPeriodsChange(next.periods);
	});

	const shouldHighlightMultiple = $derived(
		sentDate && loanDueDate && isMoreThanOneMonthAndFifteenDays(sentDate, loanDueDate)
	);

	const singleInterest = $derived.by(() => {
		return formScheduleInterest({
			capital: amount,
			periods: [
				{
					interestRate: defaultInterestType === 'rate' ? defaultInterestRate : '',
					interestAmount: defaultInterestType === 'fixed' ? defaultInterestRate : '',
					interestType: defaultInterestType
				}
			]
		}).interest;
	});

	const totals = $derived.by(() => {
		if (mode !== 'multiple' || periods.length === 0) return null;
		const principal = parseFloat(amount) || 0;
		const summary = formScheduleInterest({ capital: amount, periods });
		return {
			principal,
			avgRate: summary.averageRate,
			totalInterest: summary.interest,
			total: principal + summary.interest
		};
	});

	function handleModeChange(newMode: 'single' | 'multiple') {
		if (newMode === mode) return;
		onModeChange(newMode);
		if (
			newMode === 'multiple' &&
			periods.length === 0 &&
			sentDate &&
			loanDueDate
		) {
			dispatch({
				type: 'generate',
				sentDate,
				dueDate: loanDueDate,
				defaultRate: defaultInterestRate,
				defaultType: defaultInterestType
			});
		}
	}

	function addPeriod() {
		dispatch({
			type: 'add',
			sentDate,
			dueDate: loanDueDate,
			defaultRate: defaultInterestRate,
			defaultType: defaultInterestType
		});
	}

	function removePeriod(id: string) {
		dispatch({ type: 'remove', id });
	}

	function setDueDate(id: string, value: string) {
		dispatch({ type: 'setDueDate', id, value });
	}

	function setType(id: string, interestType: 'rate' | 'fixed') {
		dispatch({ type: 'setType', id, interestType, principal: amount });
	}

	function setValue(id: string, field: 'rate' | 'fixed', value: string) {
		dispatch({ type: 'editValue', id, field, value, principal: amount });
	}
</script>

<div class="space-y-3">
	<Tabs.Root value={mode} onValueChange={(v) => handleModeChange(v as 'single' | 'multiple')}>
		<Tabs.List
			class={shouldHighlightMultiple && mode === 'multiple'
				? 'ring-2 ring-primary ring-offset-2'
				: ''}
		>
			<Tabs.Trigger value="single">One Time Interest</Tabs.Trigger>
			<Tabs.Trigger value="multiple">Multiple Interest</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="single" class="mt-4 space-y-3">
			<div class="space-y-2 rounded-lg bg-muted/50 p-4">
				<div class="grid grid-cols-3 gap-4 text-sm">
					<div>
						<p class="text-xs text-muted-foreground">Principal</p>
						<p class="font-semibold">{formatCurrency(parseFloat(amount) || 0)}</p>
					</div>
					<div>
						<p class="text-xs text-muted-foreground">
							{defaultInterestType === 'fixed' ? 'Fixed' : 'Rate'}
						</p>
						<p class="font-semibold">
							{defaultInterestType === 'fixed'
								? formatCurrency(parseFloat(defaultInterestRate) || 0)
								: formatPercentage(parseFloat(defaultInterestRate) || 0)}
						</p>
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Due Date</p>
						<p class="font-semibold">{loanDueDate || '-'}</p>
					</div>
				</div>
				<p class="text-xs text-muted-foreground">
					Interest {formatCurrency(singleInterest)}
				</p>
			</div>
		</Tabs.Content>

		<Tabs.Content value="multiple" class="mt-4 space-y-3">
			<Button type="button" variant="outline" size="sm" class="w-full" onclick={addPeriod}>
				<Plus class="mr-2 h-4 w-4" />
				Add Period
			</Button>

			{#each periods as period, index (period.id)}
				{@const isLast = index === periods.length - 1}
				<div class="space-y-2 rounded-lg border bg-muted/30 p-3">
					<div class="flex items-center justify-between gap-2">
						<span class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
							{isLast ? `Period ${index + 1} (Final)` : `Period ${index + 1}`}
							{#if period.status && period.status !== 'Pending'}
								<span class="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
									{period.status}
								</span>
							{/if}
							{#if isPaidPeriod(period)}
								{#if isLocked(period)}
									<button
										type="button"
										class="text-[11px] font-medium text-primary-strong underline-offset-2 hover:underline"
										onclick={() => unlockPeriod(period)}
									>
										Unlock
									</button>
								{:else}
									<span class="text-[11px] text-muted-foreground">Unlocked</span>
								{/if}
							{/if}
						</span>
						{#if periods.length > 1 && !isLast}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								aria-label="Remove period"
								onclick={() => removePeriod(period.id)}
							>
								<X class="h-3 w-3" />
							</Button>
						{/if}
					</div>

					<div class="space-y-2">
						<Label class="text-xs" for="period-date-{period.id}">Due Date</Label>
						<Input
							id="period-date-{period.id}"
							type="date"
							value={period.dueDate}
							disabled={isLast || isLocked(period)}
							min={sentDate}
							max={loanDueDate}
							oninput={(e) => setDueDate(period.id, e.currentTarget.value)}
						/>
					</div>

					<Tabs.Root
						value={period.interestType}
						onValueChange={(v) => setType(period.id, v as 'rate' | 'fixed')}
					>
						<Tabs.List class="grid h-8 w-full grid-cols-2">
							<Tabs.Trigger value="rate" class="text-xs">Rate (%)</Tabs.Trigger>
							<Tabs.Trigger value="fixed" class="text-xs">Fixed (₱)</Tabs.Trigger>
						</Tabs.List>
						<Tabs.Content value="rate" class="mt-2">
							<Input
								type="number"
								step="0.01"
								inputmode="decimal"
								aria-label="Interest rate for period {index + 1}"
								value={period.interestRate}
								disabled={isLocked(period)}
								oninput={(e) => setValue(period.id, 'rate', e.currentTarget.value)}
							/>
						</Tabs.Content>
						<Tabs.Content value="fixed" class="mt-2">
							<Input
								type="number"
								step="0.01"
								inputmode="decimal"
								aria-label="Fixed interest for period {index + 1}"
								value={period.interestAmount}
								disabled={isLocked(period)}
								oninput={(e) => setValue(period.id, 'fixed', e.currentTarget.value)}
							/>
						</Tabs.Content>
					</Tabs.Root>
				</div>
			{/each}

			{#if totals}
				<div class="grid grid-cols-2 gap-3 rounded-lg border bg-muted/50 p-4 md:grid-cols-4">
					<div>
						<p class="text-xs text-muted-foreground">Total Principal</p>
						<p class="font-semibold">{formatCurrency(totals.principal)}</p>
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Total rate</p>
						<p class="font-semibold">{formatPercentage(totals.avgRate)}</p>
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Total Interest</p>
						<p class="font-semibold">{formatCurrency(totals.totalInterest)}</p>
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Total Amount</p>
						<p class="font-semibold">{formatCurrency(totals.total)}</p>
					</div>
				</div>
			{/if}

			{#if hasDuplicateInterestDueDates(periods)}
				<p class="text-sm text-destructive">Duplicate due dates in interest periods.</p>
			{/if}
		</Tabs.Content>
	</Tabs.Root>
</div>
