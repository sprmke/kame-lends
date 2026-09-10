<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Card from '$lib/components/ui/card';

	interface Props {
		message: string;
		actions?: Snippet;
	}

	let { message, actions }: Props = $props();
</script>

<Card.Root>
	<Card.Content class="dashboard-empty gap-3 text-center">
		<p class="text-sm text-muted-foreground">{message}</p>
		{#if actions}
			<div class="flex flex-wrap justify-center gap-2">
				{@render actions()}
			</div>
		{/if}
	</Card.Content>
</Card.Root>
