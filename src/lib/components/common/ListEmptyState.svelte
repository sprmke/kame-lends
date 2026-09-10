<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	interface Props {
		message: string;
		icon?: Component;
		actions?: Snippet;
	}

	let { message, icon, actions }: Props = $props();
</script>

<div class="empty-state-well gap-3 text-muted-foreground">
	{#if icon}
		{@const Icon = icon}
		<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
			<Icon class="h-5 w-5" />
		</div>
	{/if}
	<p class="text-sm">{message}</p>
	{#if actions}
		<div class="flex flex-wrap justify-center gap-2">
			{@render actions()}
		</div>
	{/if}
</div>
