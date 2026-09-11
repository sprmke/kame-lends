<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Tabs from '$lib/components/ui/tabs';
	import SearchableSelect from '$lib/components/common/SearchableSelect.svelte';
	import { Pencil, Plus, Trash2, UserCheck, X } from 'lucide-svelte';
	import { calculateInterest } from '$lib/calculations';
	import { formatCurrency, formatPercentage, formatText } from '$lib/format';
	import { toast } from '$lib/toast';
	import type { LoanWitness } from '$lib/types';
	import type { DropdownOption } from '$lib/dropdown-ux';

	interface Props {
		loanWitnesses: LoanWitness[];
		loanId: number;
		totalPrincipal: number;
		onRefresh?: () => void | Promise<void>;
		canAdminEdit?: boolean;
		myLoanWitnessId?: number | null;
	}

	let {
		loanWitnesses,
		loanId,
		totalPrincipal,
		onRefresh,
		canAdminEdit = false,
		myLoanWitnessId = null
	}: Props = $props();

	let editingId = $state<number | null>(null);
	let editProfitType = $state<'rate' | 'fixed'>('rate');
	let editProfitValue = $state('0');
	let isSaving = $state(false);

	let isAdding = $state(false);
	let witnessOptions = $state<DropdownOption[]>([]);
	let loadingOptions = $state(false);
	let newWitnessId = $state('');
	let newProfitType = $state<'rate' | 'fixed'>('rate');
	let newProfitValue = $state('0');

	function canEditRow(loanWitness: LoanWitness) {
		return canAdminEdit || myLoanWitnessId === loanWitness.id;
	}

	function startEdit(loanWitness: LoanWitness) {
		editingId = loanWitness.id;
		editProfitType = loanWitness.profitType;
		editProfitValue = loanWitness.profitValue;
	}

	function cancelEdit() {
		editingId = null;
	}

	async function saveEdit(loanWitness: LoanWitness) {
		isSaving = true;
		try {
			const response = await fetch(`/api/loans/${loanId}/witnesses/${loanWitness.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					profitType: editProfitType,
					profitValue: editProfitValue
				})
			});
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				throw new Error(body.error ?? 'Failed to update profit');
			}
			toast.success('Profit updated');
			editingId = null;
			await onRefresh?.();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to update profit');
		} finally {
			isSaving = false;
		}
	}

	async function removeWitness(loanWitness: LoanWitness) {
		if (!confirm(`Remove ${loanWitness.witness.name} from this loan?`)) return;
		try {
			const response = await fetch(`/api/loans/${loanId}/witnesses/${loanWitness.id}`, {
				method: 'DELETE'
			});
			if (!response.ok) throw new Error('Failed to remove witness');
			toast.success('Witness removed');
			await onRefresh?.();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to remove witness');
		}
	}

	async function loadWitnessOptions() {
		if (witnessOptions.length > 0) return;
		loadingOptions = true;
		try {
			const response = await fetch('/api/witnesses?simple=true');
			const data = await response.json();
			if (Array.isArray(data)) {
				witnessOptions = data.map((w: { id: number; name: string }) => ({
					value: String(w.id),
					label: w.name
				}));
			}
		} catch (error) {
			console.error('Failed to load witnesses', error);
		} finally {
			loadingOptions = false;
		}
	}

	async function openAddWitness() {
		isAdding = true;
		newWitnessId = '';
		newProfitType = 'rate';
		newProfitValue = '0';
		await loadWitnessOptions();
	}

	async function submitAddWitness() {
		if (!newWitnessId) {
			toast.error('Select a witness');
			return;
		}
		isSaving = true;
		try {
			const response = await fetch(`/api/loans/${loanId}/witnesses`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					witnessId: Number(newWitnessId),
					profitType: newProfitType,
					profitValue: newProfitValue
				})
			});
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				throw new Error(body.error ?? 'Failed to add witness');
			}
			toast.success('Witness added');
			isAdding = false;
			await onRefresh?.();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to add witness');
		} finally {
			isSaving = false;
		}
	}
</script>

{#if loanWitnesses.length > 0 || canAdminEdit}
	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between space-y-0">
			<Card.Title class="dashboard-section-title">Witnesses</Card.Title>
			{#if canAdminEdit && !isAdding}
				<Button variant="outline" size="sm" onclick={openAddWitness}>
					<Plus class="mr-1 h-4 w-4" />
					Add Witness
				</Button>
			{/if}
		</Card.Header>
		<Card.Content class="space-y-3">
			{#if loanWitnesses.length === 0 && !isAdding}
				<div class="dashboard-empty gap-2">
					<UserCheck class="h-8 w-8 text-muted-foreground" />
					<p class="text-sm text-muted-foreground">No witnesses assigned</p>
				</div>
			{/if}

			{#each loanWitnesses as loanWitness (loanWitness.id)}
				<div class="rounded-lg border border-border p-3">
					<div class="flex items-center justify-between gap-2">
						<p class="text-sm font-medium">{formatText(loanWitness.witness.name)}</p>
						{#if canEditRow(loanWitness) && editingId !== loanWitness.id}
							<div class="flex items-center gap-1">
								<Button variant="ghost" size="icon" onclick={() => startEdit(loanWitness)}>
									<Pencil class="h-4 w-4" />
								</Button>
								{#if canAdminEdit}
									<Button variant="ghost" size="icon" onclick={() => removeWitness(loanWitness)}>
										<Trash2 class="h-4 w-4 text-destructive" />
									</Button>
								{/if}
							</div>
						{/if}
					</div>

					{#if editingId === loanWitness.id}
						<div class="mt-3 space-y-3">
							<Tabs.Root
								value={editProfitType}
								onValueChange={(v) => v && (editProfitType = v as 'rate' | 'fixed')}
							>
								<Tabs.List class="grid w-full grid-cols-2">
									<Tabs.Trigger value="rate">Rate (%)</Tabs.Trigger>
									<Tabs.Trigger value="fixed">Fixed (₱)</Tabs.Trigger>
								</Tabs.List>
							</Tabs.Root>
							<Input
								type="number"
								min="0"
								step="0.01"
								bind:value={editProfitValue}
								placeholder={editProfitType === 'rate' ? '10' : '0.00'}
								disabled={isSaving}
							/>
							<div class="flex justify-end gap-2">
								<Button variant="outline" size="sm" onclick={cancelEdit} disabled={isSaving}>
									<X class="mr-1 h-4 w-4" />
									Cancel
								</Button>
								<Button size="sm" onclick={() => saveEdit(loanWitness)} disabled={isSaving}>
									{isSaving ? 'Saving...' : 'Save'}
								</Button>
							</div>
						</div>
					{:else}
						<div class="mt-2 grid grid-cols-2 gap-3">
							<div>
								<p class="text-caption mb-1">Profit Rate</p>
								<p class="text-sm font-semibold">
									{loanWitness.profitType === 'fixed'
										? formatText('Fixed')
										: formatPercentage(Number(loanWitness.profitValue))}
								</p>
							</div>
							<div>
								<p class="text-caption mb-1">Profit</p>
								<p class="text-sm font-semibold tabular-nums">
									{formatCurrency(
										calculateInterest(
											totalPrincipal,
											loanWitness.profitValue,
											loanWitness.profitType
										)
									)}
								</p>
							</div>
						</div>
					{/if}
				</div>
			{/each}

			{#if isAdding}
				<div class="rounded-lg border border-dashed border-border p-3">
					<div class="space-y-3">
						<SearchableSelect
							options={witnessOptions}
							value={newWitnessId}
							onValueChange={(v) => (newWitnessId = v)}
							placeholder="Select a witness"
							loading={loadingOptions}
							disabled={loadingOptions}
						/>
						<Tabs.Root
							value={newProfitType}
							onValueChange={(v) => v && (newProfitType = v as 'rate' | 'fixed')}
						>
							<Tabs.List class="grid w-full grid-cols-2">
								<Tabs.Trigger value="rate">Rate (%)</Tabs.Trigger>
								<Tabs.Trigger value="fixed">Fixed (₱)</Tabs.Trigger>
							</Tabs.List>
						</Tabs.Root>
						<Input
							type="number"
							min="0"
							step="0.01"
							bind:value={newProfitValue}
							placeholder={newProfitType === 'rate' ? '10' : '0.00'}
							disabled={isSaving}
						/>
						<div class="flex justify-end gap-2">
							<Button variant="outline" size="sm" onclick={() => (isAdding = false)} disabled={isSaving}>
								Cancel
							</Button>
							<Button size="sm" onclick={submitAddWitness} disabled={isSaving}>
								{isSaving ? 'Adding...' : 'Add'}
							</Button>
						</div>
					</div>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
{/if}
