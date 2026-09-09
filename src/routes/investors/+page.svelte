<script lang="ts">
	import { onMount } from 'svelte';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SearchFilter from '$lib/components/common/SearchFilter.svelte';
	import ViewModeToggle from '$lib/components/common/ViewModeToggle.svelte';
	import ExportButton from '$lib/components/common/ExportButton.svelte';
	import CardPagination from '$lib/components/common/CardPagination.svelte';
	import ListPageSkeleton from '$lib/components/common/ListPageSkeleton.svelte';
	import InvestorsTable from '$lib/components/investors/InvestorsTable.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { createResponsiveViewMode } from '$lib/composables/use-responsive-view-mode.svelte';
	import { formatCurrencyCompact, formatPercentage, formatText } from '$lib/format';
	import { calculateAverageRate, calculateInvestorStats } from '$lib/calculations';
	import { PlusCircle } from 'lucide-svelte';
	import { downloadInvestorsPdf } from '$lib/pdf-download';
	import { investorPDFSections } from '$lib/pdf-sections';
	import type { InvestorWithLoans } from '$lib/types';

	let { data } = $props();

	let items = $state<InvestorWithLoans[] | null>(null);

	$effect(() => {
		let active = true;
		data.items.then((value) => {
			if (active) items = value as unknown as InvestorWithLoans[];
		});
		return () => {
			active = false;
		};
	});

	const viewModeState = createResponsiveViewMode();
	let searchQuery = $state('');

	onMount(() => viewModeState.init());

	const filteredInvestors = $derived(
		(items ?? []).filter((investor) => {
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			return investor.name.toLowerCase().includes(q) || investor.email.toLowerCase().includes(q);
		})
	);
</script>

<svelte:head><title>Investors</title></svelte:head>

{#if items === null}
	<ListPageSkeleton variant="investors" />
{:else}
	<DashboardPage>
		<PageHeader title="Investors" showPriceToggle={true}>
			{#if items.length > 0}
				<ExportButton
					data={items}
					filteredData={filteredInvestors}
					sections={investorPDFSections}
					onGeneratePDF={downloadInvestorsPdf}
				/>
			{/if}
			<Button href="/investors/new" size="sm">
				<PlusCircle class="mr-2 h-4 w-4" />
				Add Investor
			</Button>
		</PageHeader>

		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<SearchFilter
				value={searchQuery}
				onChange={(value) => {
					searchQuery = value;
				}}
				placeholder="Search investors..."
			/>
			<ViewModeToggle
				viewMode={viewModeState.viewMode}
				onViewModeChange={(mode) => viewModeState.setViewMode(mode)}
			/>
		</div>

		{#if filteredInvestors.length === 0}
			<p class="text-muted-foreground">No investors yet.</p>
		{:else if viewModeState.viewMode === 'table'}
			<InvestorsTable investors={filteredInvestors} />
		{:else}
			<CardPagination items={filteredInvestors} itemsPerPage={9} itemName="investors">
				{#snippet children(cardInvestors)}
					<div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
						{#each cardInvestors as investor (investor.id)}
							{@const stats = calculateInvestorStats(investor)}
							{@const avgRate = calculateAverageRate(investor.loanInvestors)}
							<Card.Root class="transition-shadow hover:shadow-lg">
								<Card.Header class="pb-2">
									<Card.Title class="truncate text-base">{formatText(investor.name)}</Card.Title>
								</Card.Header>
								<Card.Content class="space-y-2 text-sm">
									<p class="truncate text-muted-foreground">{formatText(investor.email)}</p>
									<div class="grid grid-cols-2 gap-2">
										<div class="rounded-lg bg-muted/50 p-2">
											<p class="text-[10px] text-muted-foreground">Capital</p>
											<p class="font-medium tabular-nums">
												{formatCurrencyCompact(stats.totalCapital)}
											</p>
										</div>
										<div class="rounded-lg bg-muted/50 p-2">
											<p class="text-[10px] text-muted-foreground">Rate</p>
											<p class="font-medium tabular-nums">{formatPercentage(avgRate)}</p>
										</div>
									</div>
								</Card.Content>
								<Card.Footer class="border-t pt-3">
									<Button
										href="/investors/{investor.id}"
										variant="outline"
										size="sm"
										class="w-full"
									>
										Open
									</Button>
								</Card.Footer>
							</Card.Root>
						{/each}
					</div>
				{/snippet}
			</CardPagination>
		{/if}
	</DashboardPage>
{/if}
