<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import MultiSelectFilter from '$lib/components/common/MultiSelectFilter.svelte';
	import DebtEntryCard from '$lib/components/debts/DebtEntryCard.svelte';
	import InvestorFormModal from '$lib/components/investors/InvestorFormModal.svelte';
	import {
		debtToEntry,
		makeDebtEntry,
		makeDebtFee,
		type DebtFeeEntry,
		type DebtFormEntry
	} from '$lib/components/debts/debt-form-types';
	import { toast } from '$lib/toast';
	import { normalizeDebtFees, normalizeInterestRate } from '$lib/debt-calculations';
	import type { DebtInterestPeriodWithPayments, DebtWithInvestor, Investor } from '$lib/types';
	import { Plus, UserPlus, X } from 'lucide-svelte';

	interface Props {
		investors?: Investor[];
		preselectedInvestorId?: number;
		existingDebt?: DebtWithInvestor;
		initialInterestPeriods?: DebtInterestPeriodWithPayments[];
		cancelHref?: string;
		onSuccess?: () => void | Promise<void>;
		onCancel?: () => void;
		onPaymentsChange?: () => void | Promise<void>;
	}

	let {
		investors: initialInvestors = [],
		preselectedInvestorId,
		existingDebt,
		initialInterestPeriods,
		cancelHref = '/debts',
		onSuccess,
		onCancel,
		onPaymentsChange
	}: Props = $props();

	const isEditMode = $derived(!!existingDebt);
	const isModalMode = $derived(Boolean(onSuccess));
	const baseId = `debt-form-${Math.random().toString(36).slice(2, 9)}`;
	let entryCounter = 1;
	let feeCounter = 0;

	let investorList = $state<Investor[]>([...initialInvestors]);
	let selectedInvestorIds = $state<string[]>(
		existingDebt
			? [String(existingDebt.investorId)]
			: preselectedInvestorId
				? [String(preselectedInvestorId)]
				: []
	);
	let entries = $state<DebtFormEntry[]>(
		existingDebt ? [debtToEntry(existingDebt, `${baseId}-0`)] : [makeDebtEntry(`${baseId}-0`)]
	);
	let entryErrors = $state<Record<string, Record<string, string>>>({});
	let interestPeriods = $state<DebtInterestPeriodWithPayments[]>(initialInterestPeriods ?? []);
	let isSubmitting = $state(false);
	let showInvestorModal = $state(false);

	$effect(() => {
		if (initialInvestors.length > 0) {
			investorList = [...initialInvestors];
		}
	});

	$effect(() => {
		if (initialInterestPeriods) {
			interestPeriods = initialInterestPeriods;
		}
	});

	const investorOptions = $derived(
		investorList.map((investor) => ({
			value: String(investor.id),
			label: investor.name
		}))
	);

	const totalDebtCount = $derived(entries.length * Math.max(selectedInvestorIds.length, 1));

	function makeEmptyEntry(): DebtFormEntry {
		return makeDebtEntry(`${baseId}-${entryCounter++}`);
	}

	function handleEntryChange(id: string, field: keyof DebtFormEntry, value: unknown) {
		entries = entries.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry));
		if (entryErrors[id]?.[field as string]) {
			const next = { ...entryErrors };
			if (next[id]) {
				next[id] = { ...next[id] };
				delete next[id][field as string];
			}
			entryErrors = next;
		}
	}

	function handleAddFee(entryId: string) {
		const feeId = `${baseId}-fee-${feeCounter++}`;
		entries = entries.map((entry) =>
			entry.id === entryId
				? { ...entry, additionalFees: [...entry.additionalFees, makeDebtFee(feeId)] }
				: entry
		);
	}

	function handleFeeChange(
		entryId: string,
		feeId: string,
		field: keyof DebtFeeEntry,
		value: string
	) {
		entries = entries.map((entry) =>
			entry.id === entryId
				? {
						...entry,
						additionalFees: entry.additionalFees.map((fee) =>
							fee.id === feeId ? { ...fee, [field]: value } : fee
						)
					}
				: entry
		);
	}

	function handleRemoveFee(entryId: string, feeId: string) {
		entries = entries.map((entry) =>
			entry.id === entryId
				? { ...entry, additionalFees: entry.additionalFees.filter((fee) => fee.id !== feeId) }
				: entry
		);
	}

	function handleAddEntry() {
		entries = [...entries, makeEmptyEntry()];
	}

	function handleRemoveEntry(id: string) {
		entries = entries.filter((entry) => entry.id !== id);
		const next = { ...entryErrors };
		delete next[id];
		entryErrors = next;
	}

	function handleRemoveInvestor(id: string) {
		selectedInvestorIds = selectedInvestorIds.filter((value) => value !== id);
	}

	function handleNewInvestorSuccess(newInvestor: Investor) {
		investorList = [...investorList, newInvestor];
		selectedInvestorIds = [...selectedInvestorIds, String(newInvestor.id)];
	}

	async function refreshInterestPeriods() {
		if (!existingDebt?.id) return;
		try {
			const response = await fetch(`/api/debts/${existingDebt.id}`);
			if (!response.ok) return;
			const data = await response.json();
			interestPeriods = (data.interestPeriods ?? []) as DebtInterestPeriodWithPayments[];
			await onPaymentsChange?.();
		} catch (error) {
			console.error('Error refreshing debt periods:', error);
		}
	}

	function validate(): boolean {
		const errors: Record<string, Record<string, string>> = {};
		let valid = true;

		for (const entry of entries) {
			const fieldErrors: Record<string, string> = {};
			if (!entry.name.trim()) {
				fieldErrors.name = 'Borrowing name is required';
				valid = false;
			}
			if (!entry.amount || Number.parseFloat(entry.amount) <= 0) {
				fieldErrors.amount = 'A valid principal amount is required';
				valid = false;
			}
			if (!entry.debtDate) {
				fieldErrors.debtDate = 'Start date is required';
				valid = false;
			}
			if (!entry.interestRate || Number.parseFloat(entry.interestRate) < 0) {
				fieldErrors.interestRate = 'A valid interest rate is required';
				valid = false;
			}
			const duration = Number.parseInt(entry.durationMonths, 10);
			if (!entry.durationMonths || Number.isNaN(duration) || duration < 1) {
				fieldErrors.durationMonths = 'Duration must be at least 1 month';
				valid = false;
			}
			if (Object.keys(fieldErrors).length > 0) {
				errors[entry.id] = fieldErrors;
			}
		}

		entryErrors = errors;
		return valid;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();

		if (selectedInvestorIds.length === 0) {
			toast.error('Please select at least one investor');
			return;
		}

		if (!validate()) {
			toast.error('Please fill in all required fields');
			return;
		}

		isSubmitting = true;
		try {
			const entry = entries[0];
			const validFees = normalizeDebtFees(entry.additionalFees);
			const payload = {
				investorId: Number.parseInt(selectedInvestorIds[0], 10),
				name: entry.name.trim(),
				amount: Number.parseFloat(entry.amount).toFixed(2),
				date: new Date(entry.debtDate).toISOString(),
				interestRate: normalizeInterestRate(entry.interestRate),
				interestInterval: entry.interestInterval,
				durationMonths: Number.parseInt(entry.durationMonths, 10),
				additionalFees: validFees,
				notes: entry.notes.trim() || null
			};

			if (isEditMode && existingDebt) {
				const response = await fetch(`/api/debts/${existingDebt.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});

				if (!response.ok) {
					const data = await response.json().catch(() => ({}));
					throw new Error(data.error || 'Failed to update borrowing');
				}

				const updated = await response.json();
				interestPeriods = (updated.interestPeriods ?? []) as DebtInterestPeriodWithPayments[];
				toast.success('Borrowing updated');
			} else {
				const debtsToCreate: Record<string, unknown>[] = [];

				for (const investorIdStr of selectedInvestorIds) {
					const investorId = Number.parseInt(investorIdStr, 10);
					for (const debtEntry of entries) {
						debtsToCreate.push({
							investorId,
							name: debtEntry.name.trim(),
							amount: Number.parseFloat(debtEntry.amount).toFixed(2),
							date: new Date(debtEntry.debtDate).toISOString(),
							interestRate: normalizeInterestRate(debtEntry.interestRate),
							interestInterval: debtEntry.interestInterval,
							durationMonths: Number.parseInt(debtEntry.durationMonths, 10),
							additionalFees: normalizeDebtFees(debtEntry.additionalFees),
							notes: debtEntry.notes.trim() || null
						});
					}
				}

				const results = await Promise.all(
					debtsToCreate.map((debt) =>
						fetch('/api/debts', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(debt)
						})
					)
				);

				const failedResponse = results.find((response) => !response.ok);
				if (failedResponse) {
					const data = await failedResponse.json().catch(() => ({}));
					throw new Error(data.error || 'One or more borrowings failed to create');
				}

				toast.success(
					`Successfully created ${debtsToCreate.length} borrowing${debtsToCreate.length !== 1 ? 's' : ''}`
				);
			}

			if (onSuccess) {
				await onSuccess();
			} else {
				await goto('/debts');
			}
		} catch (error) {
			console.error(error);
			toast.error(error instanceof Error ? error.message : 'Save failed');
		} finally {
			isSubmitting = false;
		}
	}

	function handleCancel() {
		if (onCancel) {
			onCancel();
			return;
		}
		goto(cancelHref);
	}

	let formRef = $state<HTMLFormElement | null>(null);

	function handleFormSubmit() {
		formRef?.requestSubmit();
	}
</script>

<form bind:this={formRef} class="dashboard-form max-w-4xl" onsubmit={handleSubmit}>
	<FormHeader
		title={isEditMode ? 'Edit Borrowing' : 'Create Borrowing'}
		description={isEditMode
			? 'Update borrowing details and preview expected interest costs'
			: 'Record a borrowing and preview expected interest costs'}
		onCancel={handleCancel}
		onSubmit={handleFormSubmit}
		{isSubmitting}
		{isEditMode}
		submitLabel={isSubmitting
			? isEditMode
				? 'Saving...'
				: 'Creating...'
			: isEditMode
				? 'Save Changes'
				: `Create Borrowing${entries.length > 1 ? 's' : ''}`}
		variant={isModalMode ? 'embedded' : 'page'}
	/>

	<Card.Root>
		<Card.Header>
			<Card.Title class="text-lg sm:text-xl">Select Investors</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-3">
			<div class="flex items-center gap-2">
				<div class="flex-1">
					<MultiSelectFilter
						options={investorOptions}
						selected={selectedInvestorIds}
						onChange={(selected) => (selectedInvestorIds = selected)}
						placeholder="Select investors"
						allLabel="Select investors..."
						triggerClassName="w-full h-10"
					/>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="h-10 shrink-0 px-3"
					disabled={isSubmitting}
					onclick={() => (showInvestorModal = true)}
				>
					<UserPlus class="mr-1.5 h-4 w-4" />
					New
				</Button>
			</div>

			{#if selectedInvestorIds.length > 0}
				<div class="flex flex-wrap gap-1.5">
					{#each selectedInvestorIds as id (id)}
						{@const investor = investorList.find((item) => String(item.id) === id)}
						{#if investor}
							<span
								class="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
							>
								{investor.name}
								<button
									type="button"
									class="ml-0.5 transition-colors hover:text-destructive"
									disabled={isSubmitting}
									onclick={() => handleRemoveInvestor(id)}
								>
									<X class="h-3 w-3" />
								</button>
							</span>
						{/if}
					{/each}
				</div>
			{/if}

			{#if !isEditMode && selectedInvestorIds.length > 1}
				<p class="text-xs text-muted-foreground">
					Each borrowing entry below will be created for all {selectedInvestorIds.length} selected investors.
				</p>
			{/if}
		</Card.Content>
	</Card.Root>

	{#each entries as entry, index (entry.id)}
		<DebtEntryCard
			{entry}
			{index}
			total={entries.length}
			errors={entryErrors[entry.id] ?? {}}
			disabled={isSubmitting}
			onChange={handleEntryChange}
			onRemove={handleRemoveEntry}
			onFeeChange={handleFeeChange}
			onAddFee={handleAddFee}
			onRemoveFee={handleRemoveFee}
			interestPeriods={isEditMode ? interestPeriods : undefined}
			onPaymentsChange={isEditMode ? refreshInterestPeriods : undefined}
		/>
	{/each}

	{#if !isEditMode}
		<Button
			type="button"
			variant="outline"
			class="w-full border-dashed"
			disabled={isSubmitting}
			onclick={handleAddEntry}
		>
			<Plus class="mr-2 h-4 w-4" />
			Add another borrowing
		</Button>
	{/if}

	<div class="flex flex-col gap-4 sm:flex-row">
		<Button
			type="button"
			variant="outline"
			class="w-full flex-1"
			disabled={isSubmitting}
			onclick={handleCancel}
		>
			Cancel
		</Button>
		<Button type="submit" class="w-full flex-1" disabled={isSubmitting}>
			{isSubmitting
				? isEditMode
					? 'Saving...'
					: 'Creating...'
				: isEditMode
					? 'Save Changes'
					: `Create ${totalDebtCount > 1 ? `${totalDebtCount} ` : ''}Borrowing${totalDebtCount !== 1 ? 's' : ''}`}
		</Button>
	</div>

	<InvestorFormModal
		open={showInvestorModal}
		onOpenChange={(open) => (showInvestorModal = open)}
		onSuccess={handleNewInvestorSuccess}
	/>
</form>
