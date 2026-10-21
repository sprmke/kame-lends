<script lang="ts" module>
	export interface PaymentEntryFieldValues {
		investorId: string;
		amount: string;
		date: string;
		interestPeriodId: string;
		notes?: string;
	}

	export interface PaymentEntryFieldChanges extends Partial<PaymentEntryFieldValues> {
		/** Set when the user edits the date by hand. */
		dateTouched?: boolean;
	}

	export interface SelectOption {
		value: string;
		label: string;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import SearchableSelect from '$lib/components/common/SearchableSelect.svelte';
	import PaymentNotesField from '$lib/components/payments/PaymentNotesField.svelte';

	interface Props {
		idPrefix: string;
		value: PaymentEntryFieldValues;
		onChange: (changes: PaymentEntryFieldChanges) => void;
		lenderOptions: SelectOption[];
		/** Shown when non-empty (received payments with an interest schedule). */
		periodOptions?: SelectOption[] | null;
		dateLabel: string;
		disabled?: boolean;
		/** Between the lender and the amount (e.g. remaining balance). */
		afterLender?: Snippet;
	}

	let {
		idPrefix,
		value,
		onChange,
		lenderOptions,
		periodOptions = null,
		dateLabel,
		disabled = false,
		afterLender
	}: Props = $props();
</script>

<div class="space-y-4">
	<div class="space-y-2">
		<Label for="{idPrefix}-lender">Lender</Label>
		<SearchableSelect
			id="{idPrefix}-lender"
			options={lenderOptions}
			value={value.investorId}
			onValueChange={(investorId) => onChange({ investorId, interestPeriodId: 'general' })}
			placeholder="Select a lender..."
			searchPlaceholder="Search lenders..."
			searchable={true}
			{disabled}
			triggerClassName="w-full"
		/>
	</div>

	{@render afterLender?.()}

	<div class="grid gap-4 sm:grid-cols-2">
		<div class="space-y-2">
			<Label for="{idPrefix}-amount">Amount</Label>
			<Input
				id="{idPrefix}-amount"
				type="number"
				inputmode="decimal"
				min="0.01"
				step="0.01"
				value={value.amount}
				placeholder="0.00"
				{disabled}
				oninput={(event) => onChange({ amount: (event.currentTarget as HTMLInputElement).value })}
			/>
		</div>
		<div class="space-y-2">
			<Label for="{idPrefix}-date">{dateLabel}</Label>
			<Input
				id="{idPrefix}-date"
				type="date"
				value={value.date}
				{disabled}
				oninput={(event) =>
					onChange({
						date: (event.currentTarget as HTMLInputElement).value,
						dateTouched: true
					})}
			/>
		</div>
	</div>

	{#if periodOptions && periodOptions.length > 1}
		<div class="space-y-2">
			<Label for="{idPrefix}-period">Apply payment to</Label>
			<SearchableSelect
				id="{idPrefix}-period"
				options={periodOptions}
				value={value.interestPeriodId}
				onValueChange={(interestPeriodId) => onChange({ interestPeriodId })}
				placeholder="Select period..."
				searchPlaceholder="Search periods..."
				{disabled}
				triggerClassName="w-full"
			/>
		</div>
	{/if}

	<PaymentNotesField
		id="{idPrefix}-notes"
		value={value.notes}
		{disabled}
		onChange={(notes) => onChange({ notes })}
	/>
</div>
