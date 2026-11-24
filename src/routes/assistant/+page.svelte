<script lang="ts">
	import AssistantPanel from '$lib/components/assistant/AssistantPanel.svelte';
</script>

<svelte:head>
	<title>Ask Kame</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-5xl flex-col px-2 pt-2 lg:px-4 lg:pt-0">
	<div class="overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm">
		<AssistantPanel variant="page" />
	</div>
</div>
