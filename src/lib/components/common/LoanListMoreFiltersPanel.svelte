<script lang="ts">
	import MultiSelectFilter, {
		type MultiSelectOption
	} from '$lib/components/common/MultiSelectFilter.svelte';
	import RangeFilter from '$lib/components/common/RangeFilter.svelte';
	import {
		LOAN_STATUS_FILTER_OPTIONS,
		LOAN_TYPE_FILTER_OPTIONS
	} from '$lib/list-filters';
	import { UserCheck, UserRound, Users } from 'lucide-svelte';

	interface Props {
		statusFilter: string[];
		typeFilter: string[];
		onStatusChange: (value: string[]) => void;
		onTypeChange: (value: string[]) => void;
		minPrincipal: string;
		maxPrincipal: string;
		onMinPrincipalChange: (value: string) => void;
		onMaxPrincipalChange: (value: string) => void;
		minAvgRate: string;
		maxAvgRate: string;
		onMinAvgRateChange: (value: string) => void;
		onMaxAvgRateChange: (value: string) => void;
		minInterest: string;
		maxInterest: string;
		onMinInterestChange: (value: string) => void;
		onMaxInterestChange: (value: string) => void;
		minTotalAmount: string;
		maxTotalAmount: string;
		onMinTotalAmountChange: (value: string) => void;
		onMaxTotalAmountChange: (value: string) => void;
		investorFilterOptions?: MultiSelectOption[];
		selectedInvestors?: string[];
		onInvestorsChange?: (value: string[]) => void;
		borrowerFilterOptions?: MultiSelectOption[];
		selectedBorrowers?: string[];
		onBorrowersChange?: (value: string[]) => void;
		witnessFilterOptions?: MultiSelectOption[];
		selectedWitnesses?: string[];
		onWitnessesChange?: (value: string[]) => void;
	}

	let {
		statusFilter,
		typeFilter,
		onStatusChange,
		onTypeChange,
		minPrincipal,
		maxPrincipal,
		onMinPrincipalChange,
		onMaxPrincipalChange,
		minAvgRate,
		maxAvgRate,
		onMinAvgRateChange,
		onMaxAvgRateChange,
		minInterest,
		maxInterest,
		onMinInterestChange,
		onMaxInterestChange,
		minTotalAmount,
		maxTotalAmount,
		onMinTotalAmountChange,
		onMaxTotalAmountChange,
		investorFilterOptions = [],
		selectedInvestors = [],
		onInvestorsChange = () => {},
		borrowerFilterOptions = [],
		selectedBorrowers = [],
		onBorrowersChange = () => {},
		witnessFilterOptions = [],
		selectedWitnesses = [],
		onWitnessesChange = () => {}
	}: Props = $props();
</script>

<div class="grid grid-cols-2 gap-3 border-b border-border/50 pb-3 xl:hidden">
	<div>
		<p class="mb-2 block text-xs font-semibold">Status</p>
		<MultiSelectFilter
			options={LOAN_STATUS_FILTER_OPTIONS}
			selected={statusFilter}
			onChange={onStatusChange}
			placeholder="Select Status"
			allLabel="All Status"
			triggerClassName="w-full"
		/>
	</div>
	<div>
		<p class="mb-2 block text-xs font-semibold">Type</p>
		<MultiSelectFilter
			options={LOAN_TYPE_FILTER_OPTIONS}
			selected={typeFilter}
			onChange={onTypeChange}
			placeholder="Select Type"
			allLabel="All Types"
			triggerClassName="w-full"
		/>
	</div>
</div>

<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
	<RangeFilter
		label="Total Principal"
		minValue={minPrincipal}
		maxValue={maxPrincipal}
		onMinChange={onMinPrincipalChange}
		onMaxChange={onMaxPrincipalChange}
		minPlaceholder="Min (₱)"
		maxPlaceholder="Max (₱)"
	/>
	<RangeFilter
		label="Avg. Rate"
		minValue={minAvgRate}
		maxValue={maxAvgRate}
		onMinChange={onMinAvgRateChange}
		onMaxChange={onMaxAvgRateChange}
		minPlaceholder="Min (%)"
		maxPlaceholder="Max (%)"
	/>
	<RangeFilter
		label="Total Interest"
		minValue={minInterest}
		maxValue={maxInterest}
		onMinChange={onMinInterestChange}
		onMaxChange={onMaxInterestChange}
		minPlaceholder="Min (₱)"
		maxPlaceholder="Max (₱)"
	/>
	<RangeFilter
		label="Total Amount"
		minValue={minTotalAmount}
		maxValue={maxTotalAmount}
		onMinChange={onMinTotalAmountChange}
		onMaxChange={onMaxTotalAmountChange}
		minPlaceholder="Min (₱)"
		maxPlaceholder="Max (₱)"
	/>
</div>

<div class="grid grid-cols-1 gap-3 border-t border-border/50 pt-3 sm:grid-cols-2 xl:grid-cols-3">
	{#if investorFilterOptions.length > 0}
		<div class="space-y-2">
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

	<div class="space-y-2">
		<p class="flex items-center gap-1 text-xs font-semibold">
			<UserCheck class="h-3.5 w-3.5" />
			Borrowers
			{#if selectedBorrowers.length > 0}({selectedBorrowers.length}){/if}
		</p>
		<MultiSelectFilter
			options={borrowerFilterOptions}
			selected={selectedBorrowers}
			onChange={onBorrowersChange}
			placeholder="All Borrowers"
			allLabel="All Borrowers"
			searchPlaceholder="Search borrowers..."
			searchable={true}
			triggerClassName="w-full"
		/>
	</div>

	<div class="space-y-2">
		<p class="flex items-center gap-1 text-xs font-semibold">
			<UserRound class="h-3.5 w-3.5" />
			Witnesses
			{#if selectedWitnesses.length > 0}({selectedWitnesses.length}){/if}
		</p>
		<MultiSelectFilter
			options={witnessFilterOptions}
			selected={selectedWitnesses}
			onChange={onWitnessesChange}
			placeholder="All Witnesses"
			allLabel="All Witnesses"
			searchPlaceholder="Search witnesses..."
			searchable={true}
			triggerClassName="w-full"
		/>
	</div>
</div>
