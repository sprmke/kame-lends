<script lang="ts">
	import MultiSelectFilter from '$lib/components/common/MultiSelectFilter.svelte';
	import RangeFilter from '$lib/components/common/RangeFilter.svelte';
	import SingleSelectFilter from '$lib/components/common/SingleSelectFilter.svelte';
	import { DEBT_INTERVAL_FILTER_OPTIONS } from '$lib/list-filters';
	import { Users } from 'lucide-svelte';
	import type { MultiSelectOption } from '$lib/components/common/MultiSelectFilter.svelte';

	const REPAYMENT_FILTER_OPTIONS = [
		{ value: 'hide', label: 'Hide Repaid' },
		{ value: 'show', label: 'Show Repaid' }
	] as const;

	interface Props {
		showPastDebts: boolean;
		onShowPastDebtsChange: (value: boolean) => void;
		intervalFilter: string[];
		onIntervalChange: (value: string[]) => void;
		minAmount: string;
		maxAmount: string;
		onMinAmountChange: (value: string) => void;
		onMaxAmountChange: (value: string) => void;
		investorFilterOptions: MultiSelectOption[];
		selectedInvestors: string[];
		onInvestorsChange: (value: string[]) => void;
	}

	let {
		showPastDebts,
		onShowPastDebtsChange,
		intervalFilter,
		onIntervalChange,
		minAmount,
		maxAmount,
		onMinAmountChange,
		onMaxAmountChange,
		investorFilterOptions,
		selectedInvestors,
		onInvestorsChange
	}: Props = $props();
</script>

<div class="grid grid-cols-2 gap-3 border-b border-border/50 pb-3 xl:hidden">
	<div class="space-y-2">
		<p class="text-xs font-semibold">Repaid Borrowings</p>
		<SingleSelectFilter
			options={REPAYMENT_FILTER_OPTIONS}
			value={showPastDebts ? 'show' : 'hide'}
			onChange={(value) => onShowPastDebtsChange(value === 'show')}
		/>
	</div>
	<div class="space-y-2">
		<p class="text-xs font-semibold">Accrual Period</p>
		<MultiSelectFilter
			options={DEBT_INTERVAL_FILTER_OPTIONS}
			selected={intervalFilter}
			onChange={onIntervalChange}
			placeholder="Accrual Period"
			allLabel="All Periods"
			triggerClassName="w-full"
		/>
	</div>
</div>

<RangeFilter
	label="Principal Amount"
	minValue={minAmount}
	maxValue={maxAmount}
	onMinChange={onMinAmountChange}
	onMaxChange={onMaxAmountChange}
	minPlaceholder="Min (₱)"
	maxPlaceholder="Max (₱)"
/>

{#if investorFilterOptions.length > 0}
	<div class="space-y-2 border-t border-border/50 pt-3">
		<p class="flex items-center gap-1 text-xs font-semibold">
			<Users class="h-3.5 w-3.5" />
			Investors
			{#if selectedInvestors.length > 0}({selectedInvestors.length}){/if}
		</p>
		<MultiSelectFilter
			options={investorFilterOptions}
			selected={selectedInvestors}
			onChange={onInvestorsChange}
			placeholder="All Investors"
			allLabel="All Investors"
			searchPlaceholder="Search investors..."
			searchable={true}
			triggerClassName="w-full"
		/>
	</div>
{/if}
