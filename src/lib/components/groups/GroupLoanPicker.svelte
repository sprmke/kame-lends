<script lang="ts">
	import SearchableSelect from '$lib/components/common/SearchableSelect.svelte';
	import { Button } from '$lib/components/ui/button';
	import { toast } from '$lib/toast';
	import type { Loan } from '$lib/types';

	interface Props {
		groupId: number;
		excludeLoanIds: number[];
		onAdded: () => void | Promise<void>;
	}

	let { groupId, excludeLoanIds, onAdded }: Props = $props();

	let loans = $state<Loan[] | null>(null);
	let selectedLoanId = $state('');
	let isSubmitting = $state(false);

	$effect(() => {
		let active = true;
		fetch('/api/loans')
			.then((response) => (response.ok ? response.json() : []))
			.then((value: Loan[]) => {
				if (active) loans = value;
			})
			.catch(() => {
				if (active) loans = [];
			});
		return () => {
			active = false;
		};
	});

	const excludeSet = $derived(new Set(excludeLoanIds));
	const options = $derived(
		(loans ?? [])
			.filter((loan) => !excludeSet.has(loan.id))
			.map((loan) => ({ value: String(loan.id), label: loan.loanName }))
	);

	async function handleAdd() {
		if (!selectedLoanId) return;
		isSubmitting = true;
		try {
			const response = await fetch(`/api/groups/${groupId}/loans`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ loanId: Number(selectedLoanId) })
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to add loan');
			}
			toast.success('Loan added to group');
			selectedLoanId = '';
			await onAdded();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to add loan');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
	<SearchableSelect
		{options}
		value={selectedLoanId}
		onValueChange={(value) => (selectedLoanId = value)}
		placeholder="Select a loan to add..."
		loading={loans === null}
		disabled={isSubmitting}
		class="min-w-0 flex-1"
	/>
	<Button onclick={handleAdd} disabled={!selectedLoanId || isSubmitting} class="shrink-0">
		{isSubmitting ? 'Adding...' : 'Add loan'}
	</Button>
</div>
