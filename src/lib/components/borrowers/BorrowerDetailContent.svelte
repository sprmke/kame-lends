<script lang="ts">
	import ContactInfoCard from '$lib/components/common/ContactInfoCard.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { formatDateVeryShort, formatText } from '$lib/format';
	import { getLoanStatusBadge, getLoanTypeBadge } from '$lib/badge-config';
	import { cn } from '$lib/utils';
	import type { BorrowerWithLoans } from '$lib/types';

	interface Props {
		borrower: BorrowerWithLoans;
		showHeader?: boolean;
	}

	let { borrower, showHeader = true }: Props = $props();

	const loans = $derived(borrower.loans ?? []);
</script>

<div class="dashboard-stack">
	{#if showHeader}
		<div class="space-y-1">
			<h2 class="text-base font-medium tracking-tight">{formatText(borrower.name)}</h2>
		</div>
	{/if}

	<ContactInfoCard
		name={borrower.name}
		email={borrower.email}
		contactNumber={borrower.contactNumber}
		address={borrower.address}
	/>

	{#if borrower.notes}
		<div class="space-y-1">
			<p class="text-xs font-semibold text-muted-foreground">Notes</p>
			<p class="text-sm text-muted-foreground">{borrower.notes}</p>
		</div>
	{/if}

	<div class="space-y-3">
		<h3 class="text-sm font-semibold">Loans ({loans.length})</h3>
		{#if loans.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center text-muted-foreground">No loans yet</Card.Content>
			</Card.Root>
		{:else}
			{#each loans as loan (loan.id)}
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
		{/if}
	</div>
</div>
