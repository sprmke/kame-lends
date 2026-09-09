<script lang="ts">
	const phrase = 'Smart Lending Management';
	const items = Array.from({ length: 12 });
</script>

<div class="overflow-hidden border-y border-border/60 bg-foreground py-5">
	<div
		class="landing-ticker flex text-lg font-bold tracking-tight whitespace-nowrap text-background sm:text-xl"
	>
		{#each items as _, i}
			<span class="inline-flex items-center gap-6 px-6">
				<span>{phrase}</span>
				<span class="text-primary" aria-hidden="true">→</span>
			</span>
		{/each}
		{#each items as _, i}
			<span class="inline-flex items-center gap-6 px-6">
				<span>{phrase}</span>
				<span class="text-primary" aria-hidden="true">→</span>
			</span>
		{/each}
	</div>
</div>
