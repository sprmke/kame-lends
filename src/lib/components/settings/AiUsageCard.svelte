<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { toast } from '$lib/toast';

	type Usage = {
		turns: number;
		assistantMessages: number;
		users: number;
		inputTokens: number;
		outputTokens: number;
		costUsd: number;
		avgMs: number;
		guard: { ok: number; regenerated: number; fallback: number };
		feedback: { up: number; down: number };
		tools: { calls: number; errors: number; errorRate: number };
		unavailable?: boolean;
	};

	let usage = $state<Usage | null>(null);
	let loading = $state(false);

	async function load() {
		loading = true;
		try {
			const response = await fetch('/api/admin/ai-usage');
			if (!response.ok) throw new Error('failed');
			usage = (await response.json()) as Usage;
		} catch {
			toast.error('Could not load assistant usage.');
		} finally {
			loading = false;
		}
	}

	const fallbackRate = $derived.by(() => {
		if (!usage || usage.assistantMessages === 0) return 0;
		return Math.round((usage.guard.fallback / usage.assistantMessages) * 1000) / 10;
	});
	const thumbsRatio = $derived.by(() => {
		if (!usage) return 0;
		const total = usage.feedback.up + usage.feedback.down;
		return total === 0 ? 0 : Math.round((usage.feedback.up / total) * 100);
	});
</script>

<Card.Root>
	<Card.Header class="pb-2">
		<Card.Title>Assistant usage</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-3">
		<Button variant="outline" size="sm" onclick={load} disabled={loading}>
			{loading ? 'Loading…' : 'Load last 7 days'}
		</Button>
		{#if usage}
			{#if usage.unavailable}
				<p class="text-sm text-muted-foreground">No usage data yet.</p>
			{:else}
				<div class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
					<div><p class="text-xs text-muted-foreground">Turns</p><p class="font-semibold">{usage.turns}</p></div>
					<div><p class="text-xs text-muted-foreground">Users</p><p class="font-semibold">{usage.users}</p></div>
					<div><p class="text-xs text-muted-foreground">Cost</p><p class="font-semibold">${usage.costUsd.toFixed(4)}</p></div>
					<div><p class="text-xs text-muted-foreground">Avg turn</p><p class="font-semibold">{(usage.avgMs / 1000).toFixed(1)} s</p></div>
					<div><p class="text-xs text-muted-foreground">Fallback</p><p class="font-semibold">{fallbackRate}%</p></div>
					<div><p class="text-xs text-muted-foreground">Helpful</p><p class="font-semibold">{thumbsRatio}%</p></div>
					<div><p class="text-xs text-muted-foreground">Tool errors</p><p class="font-semibold">{usage.tools.errorRate}%</p></div>
					<div><p class="text-xs text-muted-foreground">Input tokens</p><p class="font-semibold">{usage.inputTokens.toLocaleString()}</p></div>
					<div><p class="text-xs text-muted-foreground">Output tokens</p><p class="font-semibold">{usage.outputTokens.toLocaleString()}</p></div>
				</div>
			{/if}
		{/if}
	</Card.Content>
</Card.Root>
