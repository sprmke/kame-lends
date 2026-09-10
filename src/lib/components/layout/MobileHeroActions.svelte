<script lang="ts">
	import { mobileHeaderActions } from '$lib/stores/mobile-header-actions.svelte';
</script>

{#if mobileHeaderActions.snippet}
	<div class="mobile-hero-actions">
		{@render mobileHeaderActions.snippet()}
	</div>
{/if}
