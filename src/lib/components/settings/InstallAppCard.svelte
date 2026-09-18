<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { isStandaloneDisplay } from '$lib/pwa/capabilities';
	import { isIosSafari } from '$lib/pwa/install';
	import { Download } from 'lucide-svelte';
	import { APP_NAME } from '$lib/brand';

	let standalone = $state(false);
	let ios = $state(false);

	$effect(() => {
		standalone = isStandaloneDisplay();
		ios = isIosSafari();
	});
</script>

{#if !standalone}
	<Card.Root>
		<Card.Header class="pb-2">
			<Card.Title>Install app</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-3">
			{#if ios}
				<p class="text-sm text-muted-foreground">
					Tap Share, then Add to Home Screen to install {APP_NAME}.
				</p>
			{:else}
				<p class="text-sm text-muted-foreground">
					Install {APP_NAME} for quick access from your home screen.
				</p>
				<p class="text-sm text-muted-foreground">
					Use the install banner when it appears, or your browser menu.
				</p>
			{/if}
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<Download class="h-4 w-4" />
				<span>Works on desktop Chrome, Edge, and Android.</span>
			</div>
		</Card.Content>
	</Card.Root>
{/if}
