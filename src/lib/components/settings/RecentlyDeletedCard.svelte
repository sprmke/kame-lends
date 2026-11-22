<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { toast } from '$lib/toast';
	import { formatDate } from '$lib/format';

	type DeletedLoan = {
		id: number;
		loanName: string;
		type: string;
		dueDate: string;
		deletedAt: string;
	};

	let loans = $state<DeletedLoan[]>([]);
	let loading = $state(false);
	let loaded = $state(false);

	async function load() {
		loading = true;
		try {
			const response = await fetch('/api/loans/deleted');
			if (!response.ok) throw new Error('Failed to load');
			loans = (await response.json()) as DeletedLoan[];
			loaded = true;
		} catch (error) {
			console.error(error);
			toast.error('Could not load deleted loans.');
		} finally {
			loading = false;
		}
	}

	async function restore(id: number) {
		const response = await fetch(`/api/loans/${id}/restore`, { method: 'POST' });
		if (!response.ok) {
			toast.error('Could not restore this loan.');
			return;
		}
		loans = loans.filter((loan) => loan.id !== id);
		toast.success('Loan restored.');
	}
</script>

<Card.Root>
	<Card.Header class="pb-2">
		<Card.Title>Recently deleted</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-3">
		<Button variant="outline" size="sm" onclick={load} disabled={loading}>
			{loading ? 'Loading...' : 'Show deleted loans'}
		</Button>
		{#if loading}
			<div class="space-y-2" aria-hidden="true">
				{#each Array.from({ length: 2 }) as _, index (index)}
					<div class="flex items-center justify-between gap-3">
						<div class="min-w-0 flex-1 space-y-1.5">
							<Skeleton class="h-4 w-1/2 max-w-full" />
							<Skeleton class="h-3 w-1/3 max-w-full" />
						</div>
						<Skeleton class="h-9 w-20 shrink-0 rounded-xl" />
					</div>
				{/each}
			</div>
		{:else if loaded}
			{#if loans.length === 0}
				<p class="text-sm text-muted-foreground">No deleted loans.</p>
			{:else}
				<ul class="space-y-2 text-sm">
					{#each loans as loan (loan.id)}
						<li class="flex items-center justify-between gap-3">
							<span class="min-w-0">
								<span class="block truncate font-medium">{loan.loanName}</span>
								<span class="text-xs text-muted-foreground">
									Deleted {formatDate(loan.deletedAt)}
								</span>
							</span>
							<Button size="sm" variant="outline" onclick={() => restore(loan.id)}>
								Restore
							</Button>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</Card.Content>
</Card.Root>
