<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { toast } from '$lib/toast';

	type Check = {
		id: string;
		title: string;
		count: number;
		note?: string;
	};

	let checks = $state<Check[]>([]);
	let loading = $state(false);
	let loaded = $state(false);

	async function run() {
		loading = true;
		try {
			const response = await fetch('/api/admin/money-health');
			if (!response.ok) throw new Error('Health check failed');
			const data = (await response.json()) as { checks: Check[] };
			checks = data.checks;
			loaded = true;
		} catch (error) {
			console.error(error);
			toast.error('Could not run the health check.');
		} finally {
			loading = false;
		}
	}
</script>

<Card.Root>
	<Card.Header class="pb-2">
		<Card.Title>Data health</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-3">
		<Button variant="outline" size="sm" onclick={run} disabled={loading}>
			{loading ? 'Checking...' : 'Run health check'}
		</Button>
		{#if loading}
			<div class="space-y-2" aria-hidden="true">
				{#each Array.from({ length: 2 }) as _, index (index)}
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0 flex-1 space-y-1.5">
							<Skeleton class="h-4 w-2/3 max-w-full" />
							<Skeleton class="h-3 w-1/2 max-w-full" />
						</div>
						<Skeleton class="h-4 w-8 shrink-0" />
					</div>
				{/each}
			</div>
		{:else if loaded}
			{#if checks.every((check) => check.count === 0)}
				<p class="text-sm text-muted-foreground">No anomalies found.</p>
			{:else}
				<ul class="space-y-2 text-sm">
					{#each checks.filter((check) => check.count > 0) as check (check.id)}
						<li class="flex items-start justify-between gap-3">
							<span>
								{check.title}
								{#if check.note}
									<span class="block text-xs text-muted-foreground">{check.note}</span>
								{/if}
							</span>
							<span class="font-semibold">{check.count}</span>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</Card.Content>
</Card.Root>
