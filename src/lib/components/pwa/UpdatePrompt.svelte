<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { applyServiceWorkerUpdate } from '$lib/pwa/register';

	interface Props {
		updateReady: boolean;
	}

	let { updateReady }: Props = $props();
</script>

{#if updateReady}
	<div
		class="fixed inset-x-4 z-[45] rounded-2xl border border-border/60 bg-card p-4 shadow-lg bottom-[calc(5.5rem+var(--safe-area-bottom))] lg:inset-x-auto lg:right-4 lg:bottom-4 lg:max-w-sm"
		role="dialog"
		aria-label="Update available"
	>
		<p class="text-sm font-semibold">Update ready</p>
		<p class="mt-1 text-sm text-muted-foreground">Reload to use the latest version.</p>
		<Button type="button" class="mt-3 w-full" onclick={() => void applyServiceWorkerUpdate()}>
			Reload
		</Button>
	</div>
{/if}
