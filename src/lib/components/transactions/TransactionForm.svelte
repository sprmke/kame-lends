<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import SearchableSelect from '$lib/components/common/SearchableSelect.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import FormActions from '$lib/components/common/FormActions.svelte';
	import { cn } from '$lib/utils';
	import { toast } from '$lib/toast';
	import { toLocalDateString } from '$lib/date-utils';
	import type { Investor } from '$lib/types';

	interface Props {
		investors?: Investor[];
		preselectedInvestorId?: number;
		cancelHref?: string;
		onSuccess?: () => void | Promise<void>;
		onCancel?: () => void;
		formId?: string;
		isSubmitting?: boolean;
	}

	let {
		investors = [],
		preselectedInvestorId,
		cancelHref = '/transactions',
		onSuccess,
		onCancel,
		formId,
		isSubmitting = $bindable(false)
	}: Props = $props();

	let formRef = $state<HTMLFormElement | null>(null);
	let name = $state('');
	let direction = $state<'In' | 'Out'>('In');
	let amount = $state('');
	let transactionDate = $state(toLocalDateString(new Date()));
	let investorId = $state(preselectedInvestorId ? String(preselectedInvestorId) : '');
	let notes = $state('');
	let errors = $state<Record<string, string>>({});

	const investorOptions = $derived(
		investors.map((investor) => ({ value: String(investor.id), label: investor.name }))
	);

	function validate() {
		const next: Record<string, string> = {};
		if (!name.trim()) next.name = 'Name is required';
		const amountText = String(amount).trim();
		if (!amountText || Number(amountText) <= 0) next.amount = 'Valid amount is required';
		if (!investorId) next.investorId = 'Investor is required';
		errors = next;
		return Object.keys(next).length === 0;
	}

	function handleFormSubmit() {
		formRef?.requestSubmit();
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!validate()) return;

		isSubmitting = true;
		try {
			const response = await fetch('/api/transactions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					type: 'Investment',
					direction,
					amount,
					date: transactionDate,
					investorId: Number(investorId),
					balance: amount,
					notes: notes.trim() || null
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to create transaction');
			}

			toast.success('Transaction created');
			if (onSuccess) {
				await onSuccess();
			} else {
				await goto('/transactions');
			}
		} catch (error) {
			console.error(error);
			toast.error(error instanceof Error ? error.message : 'Save failed');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<form
	bind:this={formRef}
	id={formId}
	class={cn('dashboard-form w-full min-w-0', onCancel ? 'max-w-none' : 'max-w-2xl')}
	onsubmit={handleSubmit}
>
	{#if !onCancel}
		<FormHeader
			title="Create Transaction"
			onCancel={() => goto(cancelHref)}
			onSubmit={handleFormSubmit}
			{isSubmitting}
			isEditMode={false}
			submitLabel={isSubmitting ? 'Creating...' : 'Create'}
			variant="page"
		/>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>Details</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="space-y-2">
				<Label for="name">Name</Label>
				<Input id="name" bind:value={name} disabled={isSubmitting} required />
				{#if errors.name}<p class="text-sm text-destructive">{errors.name}</p>{/if}
			</div>

			<div class="space-y-2">
				<Label for="investorId">Investor</Label>
				<SearchableSelect
					id="investorId"
					options={investorOptions}
					value={investorId}
					onValueChange={(value) => (investorId = value)}
					placeholder="Select investor"
					searchPlaceholder="Search investors..."
					searchable={true}
					disabled={isSubmitting}
					triggerClassName="w-full"
				/>
				{#if errors.investorId}<p class="text-sm text-destructive">{errors.investorId}</p>{/if}
			</div>

			<div class="grid gap-4 sm:grid-cols-3">
				<div class="space-y-2">
					<Label for="direction">Direction</Label>
					<Select.Root type="single" bind:value={direction} disabled={isSubmitting}>
						<Select.Trigger id="direction" class="w-full">{direction}</Select.Trigger>
						<Select.Content>
							<Select.Item value="In">In</Select.Item>
							<Select.Item value="Out">Out</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2">
					<Label for="amount">Amount</Label>
					<Input
						id="amount"
						type="number"
						min="0"
						step="0.01"
						bind:value={amount}
						disabled={isSubmitting}
					/>
					{#if errors.amount}<p class="text-sm text-destructive">{errors.amount}</p>{/if}
				</div>
				<div class="space-y-2">
					<Label for="transactionDate">Date</Label>
					<Input
						id="transactionDate"
						type="date"
						bind:value={transactionDate}
						disabled={isSubmitting}
					/>
				</div>
			</div>

			<div class="space-y-2">
				<Label for="notes">Notes</Label>
				<Textarea id="notes" bind:value={notes} disabled={isSubmitting} rows={3} />
			</div>
		</Card.Content>
	</Card.Root>

	<FormActions
		onCancel={() => (onCancel ? onCancel() : goto(cancelHref))}
		{formId}
		{isSubmitting}
		layout={onCancel ? 'stacked' : 'responsive'}
		submitLabel={isSubmitting ? 'Creating...' : 'Create'}
		class={onCancel ? 'md:hidden' : 'lg:hidden'}
	/>
</form>
