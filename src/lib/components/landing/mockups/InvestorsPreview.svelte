<script lang="ts">
	import BrowserFrame from './BrowserFrame.svelte';

	const investors = [
		{ name: 'Roberto Lim', invested: '₱1,200,000', returns: '₱84,000', active: 5 },
		{ name: 'Elena Cruz', invested: '₱850,000', returns: '₱59,500', active: 3 },
		{ name: 'Miguel Tan', invested: '₱2,100,000', returns: '₱147,000', active: 8 }
	];

	function initials(name: string) {
		return name
			.split(' ')
			.map((part) => part[0])
			.join('');
	}
</script>

<BrowserFrame title="investors">
	<div class="space-y-3 p-4 sm:p-5">
		<div>
			<p class="text-[10px] font-semibold tracking-wider text-primary uppercase">Capital</p>
			<h3 class="text-sm font-bold">Investors</h3>
		</div>
		<div class="space-y-2">
			{#each investors as inv (inv.name)}
				<div
					class="flex items-center justify-between rounded-xl border border-border/40 bg-card p-3"
				>
					<div class="flex items-center gap-2.5">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary"
						>
							{initials(inv.name)}
						</div>
						<div>
							<p class="text-[11px] font-semibold">{inv.name}</p>
							<p class="text-[9px] text-muted-foreground">{inv.active} active loans</p>
						</div>
					</div>
					<div class="text-right">
						<p class="text-[10px] font-bold tabular-nums">{inv.invested}</p>
						<p class="text-[9px] font-medium text-chart-2">+{inv.returns}</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</BrowserFrame>
