<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import Pagination from '$lib/components/common/Pagination.svelte';
	import { formatCurrencyCompact, formatPercentage, formatText } from '$lib/format';
	import { calculateAverageRate, calculateInvestorStats } from '$lib/calculations';
	import { cn } from '$lib/utils';
	import { ArrowUpDown } from 'lucide-svelte';
	import type { InvestorWithLoans } from '$lib/types';

	type SortDirection = 'asc' | 'desc';
	type SortField = 'name' | 'totalCapital' | 'avgRate' | 'totalInterest' | 'totalAmount';

	interface Props {
		investors: InvestorWithLoans[];
		itemsPerPage?: number;
	}

	let { investors, itemsPerPage: initialItemsPerPage = 10 }: Props = $props();

	let sortField = $state<SortField | null>(null);
	let sortDirection = $state<SortDirection>('asc');
	let currentPage = $state(1);
	let itemsPerPage = $state(initialItemsPerPage);

	function getStats(investor: InvestorWithLoans) {
		return calculateInvestorStats(investor);
	}

	function getSortValue(investor: InvestorWithLoans, field: SortField): string | number {
		const stats = getStats(investor);
		const avgRate = calculateAverageRate(investor.loanInvestors);
		switch (field) {
			case 'name':
				return investor.name.toLowerCase();
			case 'totalCapital':
				return stats.totalCapital;
			case 'avgRate':
				return avgRate;
			case 'totalInterest':
				return stats.totalInterest;
			case 'totalAmount':
				return stats.totalCapital + stats.totalInterest;
		}
	}

	const sortedInvestors = $derived.by(() => {
		if (!sortField) return investors;
		const field = sortField;
		const sorted = [...investors];
		sorted.sort((a, b) => {
			const aValue = getSortValue(a, field);
			const bValue = getSortValue(b, field);
			let comparison;
			if (typeof aValue === 'string' && typeof bValue === 'string') {
				comparison = aValue.localeCompare(bValue);
			} else {
				comparison = Number(aValue) - Number(bValue);
			}
			return sortDirection === 'asc' ? comparison : -comparison;
		});
		return sorted;
	});

	const totalPages = $derived(Math.max(1, Math.ceil(sortedInvestors.length / itemsPerPage)));
	const paginated = $derived(
		sortedInvestors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
	);

	$effect(() => {
		if (currentPage > totalPages) currentPage = totalPages;
	});

	function handleSort(field: SortField) {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
	}

	const columns: Array<{ field: SortField; label: string; className?: string }> = [
		{ field: 'name', label: 'Name' },
		{ field: 'totalCapital', label: 'Capital' },
		{ field: 'avgRate', label: 'Rate', className: 'hidden lg:table-cell' },
		{ field: 'totalInterest', label: 'Interest', className: 'hidden xl:table-cell' },
		{ field: 'totalAmount', label: 'Amount' }
	];
</script>

<div class="space-y-4">
	<div class="overflow-hidden rounded-xl border border-border/50">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					{#each columns as column}
						<Table.Head class={column.className}>
							<button
								type="button"
								class="inline-flex items-center gap-1 font-medium hover:text-foreground"
								onclick={() => handleSort(column.field)}
							>
								{column.label}
								<ArrowUpDown
									class={cn(
										'h-3.5 w-3.5',
										sortField === column.field ? 'text-foreground' : 'text-muted-foreground/50'
									)}
								/>
							</button>
						</Table.Head>
					{/each}
					<Table.Head class="text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each paginated as investor (investor.id)}
					{@const stats = getStats(investor)}
					{@const avgRate = calculateAverageRate(investor.loanInvestors)}
					<Table.Row
						class="cursor-pointer"
						onclick={() => (window.location.href = `/investors/${investor.id}`)}
					>
						<Table.Cell>
							<span class="block truncate font-medium" title={formatText(investor.name)}>
								{formatText(investor.name)}
							</span>
						</Table.Cell>
						<Table.Cell class="font-medium tabular-nums">
							{formatCurrencyCompact(stats.totalCapital)}
						</Table.Cell>
						<Table.Cell class="hidden tabular-nums lg:table-cell">
							{formatPercentage(avgRate)}
						</Table.Cell>
						<Table.Cell class="hidden font-medium tabular-nums xl:table-cell">
							{formatCurrencyCompact(stats.totalInterest)}
						</Table.Cell>
						<Table.Cell class="font-semibold tabular-nums">
							{formatCurrencyCompact(stats.totalCapital + stats.totalInterest)}
						</Table.Cell>
						<Table.Cell class="text-right" onclick={(e) => e.stopPropagation()}>
							<Button href="/investors/{investor.id}" variant="outline" size="sm">Open</Button>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>

	<Pagination
		{currentPage}
		{totalPages}
		onPageChange={(page) => (currentPage = page)}
		itemName="investors"
	/>
</div>
