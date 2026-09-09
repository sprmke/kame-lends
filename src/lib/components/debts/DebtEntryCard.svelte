<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import DebtSummaryPreview from '$lib/components/debts/DebtSummaryPreview.svelte';
	import {
		DEBT_INTEREST_INTERVAL_OPTIONS,
		type DebtFeeEntry,
		type DebtFormEntry
	} from '$lib/components/debts/debt-form-types';
	import { normalizeDebtFees } from '$lib/debt-calculations';
	import type { DebtInterestPeriodWithPayments } from '$lib/types';
	import { Plus, Trash2 } from 'lucide-svelte';

	interface Props {
		entry: DebtFormEntry;
		index: number;
		total: number;
		errors: Record<string, string>;
		disabled?: boolean;
		onChange: (id: string, field: keyof DebtFormEntry, value: unknown) => void;
		onRemove: (id: string) => void;
		onFeeChange: (entryId: string, feeId: string, field: keyof DebtFeeEntry, value: string) => void;
		onAddFee: (entryId: string) => void;
		onRemoveFee: (entryId: string, feeId: string) => void;
		interestPeriods?: DebtInterestPeriodWithPayments[];
		onPaymentsChange?: () => void | Promise<void>;
	}

	let {
		entry,
		index,
		total,
		errors,
		disabled = false,
		onChange,
		onRemove,
		onFeeChange,
		onAddFee,
		onRemoveFee,
		interestPeriods,
		onPaymentsChange
	}: Props = $props();

	const normalizedFees = $derived(normalizeDebtFees(entry.additionalFees));
</script>

<div class="space-y-4">
	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between">
				<Card.Title class="dashboard-section-title">
					Borrowing Details
					{#if total > 1}
						<span class="ml-2 text-sm font-normal text-muted-foreground">#{index + 1}</span>
					{/if}
				</Card.Title>
				{#if total > 1}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
						{disabled}
						onclick={() => onRemove(entry.id)}
					>
						<Trash2 class="h-4 w-4" />
					</Button>
				{/if}
			</div>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="space-y-2">
				<Label>Borrowing Name *</Label>
				<Input
					value={entry.name}
					placeholder="e.g., Personal loan to Juan, Equipment financing"
					{disabled}
					oninput={(e) => onChange(entry.id, 'name', e.currentTarget.value)}
				/>
				{#if errors.name}<p class="text-sm text-destructive">{errors.name}</p>{/if}
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<Label>Principal Amount *</Label>
					<Input
						type="number"
						step="0.01"
						value={entry.amount}
						placeholder="0.00"
						{disabled}
						oninput={(e) => onChange(entry.id, 'amount', e.currentTarget.value)}
					/>
					{#if errors.amount}<p class="text-sm text-destructive">{errors.amount}</p>{/if}
				</div>
				<div class="space-y-2">
					<Label>Start Date *</Label>
					<Input
						type="date"
						value={entry.debtDate}
						{disabled}
						oninput={(e) => onChange(entry.id, 'debtDate', e.currentTarget.value)}
					/>
					{#if errors.debtDate}<p class="text-sm text-destructive">{errors.debtDate}</p>{/if}
				</div>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<Label>Interest Rate (%) *</Label>
					<Input
						type="number"
						step="0.000001"
						value={entry.interestRate}
						placeholder="e.g., 1.8612"
						{disabled}
						oninput={(e) => onChange(entry.id, 'interestRate', e.currentTarget.value)}
					/>
					{#if errors.interestRate}<p class="text-sm text-destructive">
							{errors.interestRate}
						</p>{/if}
				</div>
				<div class="space-y-2">
					<Label>Interest Accrual Period *</Label>
					<Select.Root
						type="single"
						value={entry.interestInterval}
						onValueChange={(value) => onChange(entry.id, 'interestInterval', value)}
						{disabled}
					>
						<Select.Trigger class="w-full">{entry.interestInterval}</Select.Trigger>
						<Select.Content>
							{#each DEBT_INTEREST_INTERVAL_OPTIONS as option}
								<Select.Item value={option.value}>{option.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<div class="space-y-2 sm:max-w-xs">
				<Label>Loan Duration (months) *</Label>
				<Input
					type="number"
					min="1"
					step="1"
					value={entry.durationMonths}
					placeholder="e.g., 12"
					{disabled}
					oninput={(e) => onChange(entry.id, 'durationMonths', e.currentTarget.value)}
				/>
				{#if errors.durationMonths}<p class="text-sm text-destructive">
						{errors.durationMonths}
					</p>{/if}
			</div>

			<div class="space-y-3 rounded-lg border bg-muted/30 p-4">
				<div class="flex items-center justify-between">
					<Label>Additional Fees (optional)</Label>
					<Button
						type="button"
						variant="outline"
						size="sm"
						class="h-8"
						{disabled}
						onclick={() => onAddFee(entry.id)}
					>
						<Plus class="mr-1 h-3.5 w-3.5" />
						Add Fee
					</Button>
				</div>
				{#if entry.additionalFees.length === 0}
					<p class="text-xs text-muted-foreground">
						One-time fees such as processing or service charges.
					</p>
				{:else}
					<div class="space-y-2">
						{#each entry.additionalFees as fee (fee.id)}
							<div class="flex items-start gap-2">
								<div class="flex-1">
									<Input
										value={fee.label}
										placeholder="Fee label"
										{disabled}
										oninput={(e) => onFeeChange(entry.id, fee.id, 'label', e.currentTarget.value)}
									/>
								</div>
								<div class="w-32">
									<Input
										type="number"
										step="0.01"
										value={fee.amount}
										placeholder="0.00"
										{disabled}
										oninput={(e) => onFeeChange(entry.id, fee.id, 'amount', e.currentTarget.value)}
									/>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									class="h-10 w-10 shrink-0 p-0 text-muted-foreground hover:text-destructive"
									{disabled}
									onclick={() => onRemoveFee(entry.id, fee.id)}
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="space-y-2">
				<Label>Notes (optional)</Label>
				<Textarea
					value={entry.notes}
					placeholder="Terms, collateral, or other details..."
					rows={3}
					{disabled}
					oninput={(e) => onChange(entry.id, 'notes', e.currentTarget.value)}
				/>
			</div>
		</Card.Content>
	</Card.Root>

	<DebtSummaryPreview
		principal={entry.amount}
		interestRate={entry.interestRate}
		interestInterval={entry.interestInterval}
		debtDate={entry.debtDate}
		durationMonths={Number(entry.durationMonths) || 12}
		additionalFees={normalizedFees}
		{interestPeriods}
		{onPaymentsChange}
	/>
</div>
