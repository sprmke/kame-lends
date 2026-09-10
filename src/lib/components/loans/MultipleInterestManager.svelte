<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Tabs from '$lib/components/ui/tabs';
	import { toast } from '$lib/toast';
	import { formatPercentage } from '$lib/format';
	import {
		generateDefaultInterestPeriods,
		isMoreThanOneMonthAndFifteenDays,
		toLocalDateString
	} from '$lib/date-utils';
	import { Plus, X } from 'lucide-svelte';
	import type { InterestPeriodData } from './multiple-interest-types';
	import {
		hasDuplicateInterestDueDates,
		sortInterestPeriodsByDueDate
	} from './multiple-interest-types';

	interface Props {
		sentDate: string;
		loanDueDate: string;
		amount: string;
		defaultInterestRate: string;
		defaultInterestType: 'rate' | 'fixed';
		onPeriodsChange: (periods: InterestPeriodData[]) => void;
		onModeChange: (mode: 'single' | 'multiple') => void;
		initialMode?: 'single' | 'multiple';
		initialPeriods?: InterestPeriodData[];
	}

	let {
		sentDate,
		loanDueDate,
		amount,
		defaultInterestRate,
		defaultInterestType,
		onPeriodsChange,
		onModeChange,
		initialMode = 'single',
		initialPeriods
	}: Props = $props();

	let mode = $state<'single' | 'multiple'>(initialMode);
	let userOverrodeAutoMode = $state(false);
	const isEditMode = $derived(Boolean(initialPeriods && initialPeriods.length > 0));

	function createDefaultPeriods(): InterestPeriodData[] {
		if (initialPeriods && initialPeriods.length > 0) {
			return sortInterestPeriodsByDueDate(initialPeriods);
		}
		if (!sentDate || !loanDueDate) return [];
		return generateDefaultInterestPeriods(sentDate, loanDueDate).map((period, index) => ({
			id: `period-${Date.now()}-${index}`,
			dueDate: toLocalDateString(period.dueDate),
			interestRate: defaultInterestRate || '10',
			interestAmount: '',
			interestType: defaultInterestType || 'rate'
		}));
	}

	let periods = $state<InterestPeriodData[]>(createDefaultPeriods());

	function commitPeriods(nextPeriods: InterestPeriodData[]) {
		const sorted = sortInterestPeriodsByDueDate(nextPeriods);
		periods = sorted;
		onPeriodsChange(sorted);
	}

	$effect(() => {
		if (
			!isEditMode &&
			!userOverrodeAutoMode &&
			sentDate &&
			loanDueDate &&
			isMoreThanOneMonthAndFifteenDays(sentDate, loanDueDate) &&
			mode === 'single'
		) {
			mode = 'multiple';
			onModeChange('multiple');
		}
	});

	$effect(() => {
		if (isEditMode || mode !== 'multiple' || !sentDate || !loanDueDate) return;
		const defaultPeriods = generateDefaultInterestPeriods(sentDate, loanDueDate);
		const newPeriods = defaultPeriods.map((period, index) => {
			const existing = periods[index];
			return {
				id: existing?.id || `period-${Date.now()}-${index}`,
				dueDate: toLocalDateString(period.dueDate),
				interestRate: existing?.interestRate || defaultInterestRate || '10',
				interestAmount: existing?.interestAmount || '',
				interestType: existing?.interestType || defaultInterestType || 'rate'
			};
		});
		const changed =
			newPeriods.length !== periods.length ||
			newPeriods.some((np, idx) => np.dueDate !== periods[idx]?.dueDate);
		if (changed) commitPeriods(newPeriods);
	});

	$effect(() => {
		if (mode !== 'multiple' || periods.length === 0 || !loanDueDate) return;
		const last = periods[periods.length - 1];
		if (last.dueDate !== loanDueDate) {
			commitPeriods(
				periods.map((period, index) =>
					index === periods.length - 1 ? { ...period, dueDate: loanDueDate } : period
				)
			);
		}
	});

	$effect(() => {
		if (mode !== 'multiple') return;
		const principal = parseFloat(amount) || 0;
		if (principal <= 0) return;
		let changed = false;
		const updated = periods.map((period) => {
			if (period.interestType !== 'rate') return period;
			const rate = parseFloat(period.interestRate) || 0;
			const interestAmount = (principal * (rate / 100)).toFixed(2);
			if (period.interestAmount === interestAmount) return period;
			changed = true;
			return { ...period, interestAmount };
		});
		if (!changed) return;
		periods = updated;
		onPeriodsChange(updated);
	});

	const shouldHighlightMultiple = $derived(
		sentDate && loanDueDate && isMoreThanOneMonthAndFifteenDays(sentDate, loanDueDate)
	);

	const totals = $derived.by(() => {
		if (mode !== 'multiple' || periods.length === 0) return null;
		const principal = parseFloat(amount) || 0;
		let totalInterest = 0;
		for (const period of periods) {
			if (period.interestType === 'fixed') {
				totalInterest += parseFloat(period.interestAmount) || 0;
			} else {
				totalInterest += principal * ((parseFloat(period.interestRate) || 0) / 100);
			}
		}
		const avgRate = principal > 0 ? (totalInterest / principal) * 100 : 0;
		return { principal, avgRate, totalInterest, total: principal + totalInterest };
	});

	function handleModeChange(newMode: 'single' | 'multiple') {
		mode = newMode;
		onModeChange(newMode);
		if (
			newMode === 'single' &&
			sentDate &&
			loanDueDate &&
			isMoreThanOneMonthAndFifteenDays(sentDate, loanDueDate)
		) {
			userOverrodeAutoMode = true;
		}
		if (newMode === 'multiple' && periods.length === 0) {
			commitPeriods(createDefaultPeriods());
		}
	}

	function addPeriod() {
		const newPeriod: InterestPeriodData = {
			id: `period-${Date.now()}`,
			dueDate: sentDate || toLocalDateString(new Date()),
			interestRate: defaultInterestRate || '10',
			interestAmount: '',
			interestType: defaultInterestType || 'rate'
		};
		commitPeriods([...periods.slice(0, -1), newPeriod, periods[periods.length - 1]]);
	}

	function removePeriod(id: string) {
		const index = periods.findIndex((p) => p.id === id);
		if (index === periods.length - 1) return;
		commitPeriods(periods.filter((p) => p.id !== id));
	}

	function updatePeriod(id: string, field: keyof Omit<InterestPeriodData, 'id'>, value: string) {
		const next = periods.map((period, index) => {
			if (period.id !== id) return period;
			if (field === 'dueDate' && index === periods.length - 1) return period;
			const updated = { ...period, [field]: value };
			const principal = parseFloat(amount) || 0;
			if (field === 'interestRate' && principal > 0) {
				const rate = parseFloat(value) || 0;
				updated.interestAmount = (principal * (rate / 100)).toFixed(2);
			} else if (field === 'interestAmount' && principal > 0) {
				const fixedAmount = parseFloat(value) || 0;
				updated.interestRate = ((fixedAmount / principal) * 100).toFixed(2);
			}
			return updated;
		});
		if (field === 'dueDate') commitPeriods(next);
		else {
			periods = next;
			onPeriodsChange(next);
		}
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
						<p class="font-semibold">₱{parseFloat(amount || '0').toLocaleString('en-PH')}</p>
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Rate</p>
						<p class="font-semibold">{defaultInterestRate || '0'}%</p>
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Due Date</p>
						<p class="font-semibold">{loanDueDate || '-'}</p>
					</div>
				</div>
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
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-muted-foreground">
							{isLast ? `Period ${index + 1} (Final)` : `Period ${index + 1}`}
						</span>
						{#if periods.length > 1 && !isLast}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onclick={() => removePeriod(period.id)}
							>
								<X class="h-3 w-3" />
							</Button>
						{/if}
					</div>

					<div class="space-y-2">
						<Label class="text-xs">Due Date</Label>
						<Input
							type="date"
							value={isLast ? loanDueDate : period.dueDate}
							disabled={isLast}
							oninput={(e) => {
								const newDate = e.currentTarget.value;
								if (periods.some((p) => p.id !== period.id && p.dueDate === newDate)) {
									toast.error('This date is already used by another period.');
									return;
								}
								updatePeriod(period.id, 'dueDate', newDate);
							}}
						/>
					</div>

					<Tabs.Root
						value={period.interestType}
						onValueChange={(v) => updatePeriod(period.id, 'interestType', v)}
					>
						<Tabs.List class="grid h-8 w-full grid-cols-2">
							<Tabs.Trigger value="rate" class="text-xs">Rate (%)</Tabs.Trigger>
							<Tabs.Trigger value="fixed" class="text-xs">Fixed (₱)</Tabs.Trigger>
						</Tabs.List>
						<Tabs.Content value="rate" class="mt-2">
							<Input
								type="number"
								step="0.01"
								value={period.interestRate}
								oninput={(e) => updatePeriod(period.id, 'interestRate', e.currentTarget.value)}
							/>
						</Tabs.Content>
						<Tabs.Content value="fixed" class="mt-2">
							<Input
								type="number"
								step="0.01"
								value={period.interestAmount}
								oninput={(e) => updatePeriod(period.id, 'interestAmount', e.currentTarget.value)}
							/>
						</Tabs.Content>
					</Tabs.Root>
				</div>
			{/each}

			{#if totals}
				<div class="grid grid-cols-2 gap-3 rounded-lg border bg-muted/50 p-4 md:grid-cols-4">
					<div>
						<p class="text-xs text-muted-foreground">Total Principal</p>
						<p class="font-semibold">₱{totals.principal.toLocaleString('en-PH')}</p>
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Avg. Rate</p>
						<p class="font-semibold">{formatPercentage(totals.avgRate)}</p>
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Total Interest</p>
						<p class="font-semibold">₱{totals.totalInterest.toLocaleString('en-PH')}</p>
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Total Amount</p>
						<p class="font-semibold">₱{totals.total.toLocaleString('en-PH')}</p>
					</div>
				</div>
			{/if}

			{#if hasDuplicateInterestDueDates(periods)}
				<p class="text-sm text-destructive">Duplicate due dates in interest periods.</p>
			{/if}
		</Tabs.Content>
	</Tabs.Root>
</div>
