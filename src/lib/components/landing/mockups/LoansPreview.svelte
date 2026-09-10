<script lang="ts">
	import BrowserFrame from './BrowserFrame.svelte';

	const rows = [
		{
			client: 'Maria Santos',
			type: 'Lot Title',
			principal: '₱250,000',
			status: 'Active',
			due: 'Jun 12'
		},
		{
			client: 'Juan Dela Cruz',
			type: 'OR/CR',
			principal: '₱180,000',
			status: 'Active',
			due: 'Jun 18'
		},
		{
			client: 'Ana Reyes',
			type: 'Agent',
			principal: '₱95,000',
			status: 'Past Due',
			due: 'May 02'
		},
		{
			client: 'Carlos Mendoza',
			type: 'Lot Title',
			principal: '₱420,000',
			status: 'Active',
			due: 'Jul 01'
		}
	];
</script>

<BrowserFrame title="loans">
	<div class="space-y-3 p-4 sm:p-5">
		<div>
			<p class="text-[10px] font-semibold tracking-wider text-primary uppercase">Portfolio</p>
			<h3 class="text-sm font-bold">Loans</h3>
		</div>
		<div class="surface-card overflow-hidden">
			<table class="w-full min-w-[280px] text-left text-[9px]">
				<thead class="bg-muted/50 text-muted-foreground">
					<tr>
						<th class="px-2.5 py-2 font-medium">Client</th>
						<th class="px-2 py-2 font-medium">Type</th>
						<th class="px-2 py-2 font-medium">Principal</th>
						<th class="px-2 py-2 font-medium">Status</th>
						<th class="px-2 py-2 font-medium">Due</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.client)}
						<tr class="border-t border-border/40 bg-card">
							<td class="px-2.5 py-2 font-medium">{row.client}</td>
							<td class="px-2 py-2">{row.type}</td>
							<td class="px-2 py-2 font-medium tabular-nums">{row.principal}</td>
							<td class="px-2 py-2">
								<span
									class={row.status === 'Past Due'
										? 'rounded-md bg-chart-3/15 px-1.5 py-0.5 text-[9px] font-medium text-chart-3'
										: 'rounded-md bg-chart-2/15 px-1.5 py-0.5 text-[9px] font-medium text-chart-2'}
								>
									{row.status}
								</span>
							</td>
							<td class="px-2 py-2 text-muted-foreground">{row.due}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</BrowserFrame>
