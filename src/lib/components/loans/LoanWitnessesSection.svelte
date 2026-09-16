<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import SearchableSelect from '$lib/components/common/SearchableSelect.svelte';
	import { Plus, Trash2, UserCheck } from 'lucide-svelte';
	import { formatText } from '$lib/format';
	import { toast } from '$lib/toast';
	import { loadPartyOptions } from '$lib/composables/party-options';
	import type { LoanWitness } from '$lib/types';
	import type { DropdownOption } from '$lib/dropdown-ux';

	interface Props {
		loanWitnesses: LoanWitness[];
		loanId: number;
		onRefresh?: () => void | Promise<void>;
		canAdminEdit?: boolean;
		myLoanWitnessId?: number | null;
	}

	let {
		loanWitnesses,
		loanId,
		onRefresh,
		canAdminEdit = false,
		myLoanWitnessId: _myLoanWitnessId = null
	}: Props = $props();

	let isAdding = $state(false);
	let witnessOptions = $state<DropdownOption[]>([]);
	let loadingOptions = $state(false);
	let newWitnessId = $state('');
	let isSaving = $state(false);

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
			const options = await loadPartyOptions();
			witnessOptions = options.witnesses.map((w) => ({
				value: String(w.id),
				label: w.name
			}));
		} catch (error) {
			console.error('Failed to load witnesses', error);
		} finally {
			loadingOptions = false;
		}
	}

	async function openAddWitness() {
		isAdding = true;
		newWitnessId = '';
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
					witnessId: Number(newWitnessId)
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
				<div class="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
					<p class="text-sm font-medium">{formatText(loanWitness.witness.name)}</p>
					{#if canAdminEdit}
						<Button variant="ghost" size="icon" onclick={() => removeWitness(loanWitness)}>
							<Trash2 class="h-4 w-4 text-destructive" />
						</Button>
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
