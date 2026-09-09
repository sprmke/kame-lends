<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import DetailHeader from '$lib/components/common/DetailHeader.svelte';
	import ContactInfoCard from '$lib/components/common/ContactInfoCard.svelte';
	import BorrowerForm from '$lib/components/borrowers/BorrowerForm.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { formatDateVeryShort, formatText } from '$lib/format';
	import { getLoanStatusBadge, getLoanTypeBadge } from '$lib/badge-config';
	import { cn } from '$lib/utils';
	import type { Borrower, LoanStatus, LoanType } from '$lib/types';

	type BorrowerWithLoans = Borrower & {
		loans?: Array<{
			id: number;
			loanName: string;
			type: LoanType;
			status: LoanStatus;
			dueDate: string | Date;
		}>;
	};

	let { data } = $props();

	let isEditing = $state(false);

	const borrower = $derived(data.entity as BorrowerWithLoans);
	const title = $derived(borrower?.name ?? 'Borrower');
	const canDelete = $derived((borrower?.loans?.length ?? 0) === 0);

	async function handleDelete() {
		const response = await fetch(`/api/borrowers/${borrower.id}`, { method: 'DELETE' });
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.error || 'Failed to delete borrower');
		}
		await goto('/loans');
	}
</script>

<svelte:head><title>{title}</title></svelte:head>

<DashboardPage class="max-w-3xl">
	{#if isEditing && borrower}
		<Button variant="ghost" size="sm" class="-ml-2 w-fit" onclick={() => (isEditing = false)}>
			Back to Borrower
		</Button>
		<BorrowerForm
			existingBorrower={borrower}
			onSuccess={async () => {
				isEditing = false;
				await invalidateAll();
			}}
			onCancel={() => (isEditing = false)}
		/>
	{:else if borrower}
		<DetailHeader
			{title}
			description="Borrower profile"
			backLabel="Back"
			onBack={() => history.back()}
			onEdit={() => (isEditing = true)}
			onDelete={handleDelete}
			deleteTitle="Delete Borrower"
			deleteDescription={`Delete ${borrower.name}? This cannot be undone.`}
			{canDelete}
			deleteWarning={`Cannot delete this borrower because they have ${borrower.loans?.length ?? 0} loan(s).`}
			showPriceToggle={false}
		/>

		<ContactInfoCard
			name={borrower.name}
			email={borrower.email}
			contactNumber={borrower.contactNumber}
			address={borrower.address}
		/>

		<div class="space-y-4">
			<h2 class="text-lg font-semibold">Loans ({borrower.loans?.length ?? 0})</h2>
			{#if !borrower.loans?.length}
				<Card.Root>
					<Card.Content class="py-10 text-center text-muted-foreground">No loans yet</Card.Content>
				</Card.Root>
			{:else}
				<div class="space-y-3">
					{#each borrower.loans as loan (loan.id)}
						<Card.Root>
							<Card.Content
								class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
							>
								<div class="min-w-0 space-y-1">
									<p class="truncate font-medium">{formatText(loan.loanName)}</p>
									<p class="text-sm text-muted-foreground">
										Due {formatDateVeryShort(loan.dueDate)}
									</p>
								</div>
								<div class="flex flex-wrap items-center gap-2">
									<Badge
										variant={getLoanTypeBadge(loan.type).variant}
										class={cn('text-[10px]', getLoanTypeBadge(loan.type).className)}
									>
										{loan.type}
									</Badge>
									<Badge
										variant={getLoanStatusBadge(loan.status).variant}
										class={cn('text-[10px]', getLoanStatusBadge(loan.status).className)}
									>
										{loan.status}
									</Badge>
									<Button href="/loans/{loan.id}" variant="outline" size="sm">Open</Button>
								</div>
							</Card.Content>
						</Card.Root>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</DashboardPage>
