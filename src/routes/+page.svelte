<script lang="ts">
	import LandingPage from '$lib/components/landing/LandingPage.svelte';
	import { APP_NAME } from '$lib/brand';
</script>

<svelte:head>
	<title>{APP_NAME}</title>
</svelte:head>

<LandingPage />
