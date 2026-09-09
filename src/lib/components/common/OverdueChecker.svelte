<script lang="ts">
	import { onMount } from 'svelte';
	import { runOverdueCheckOnce } from '$lib/composables/use-overdue-check.svelte';

	onMount(() => {
		runOverdueCheckOnce();
	});
</script>
