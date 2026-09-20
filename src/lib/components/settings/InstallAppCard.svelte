<script lang="ts">
	import { getContext } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { isStandaloneDisplay } from '$lib/pwa/capabilities';
	import { isIosSafari } from '$lib/pwa/install';
	import { getInstallPromptEvent, promptInstall } from '$lib/pwa/register';
	import { PWA_CONTEXT_KEY, type PwaContextValue } from '$lib/pwa/pwa-context';
	import { Smartphone } from 'lucide-svelte';
	import { APP_NAME } from '$lib/brand';

	const pwaCtx = getContext<PwaContextValue | undefined>(PWA_CONTEXT_KEY);

	let standalone = $state(false);
	let ios = $state(false);

	$effect(() => {
		standalone = isStandaloneDisplay();
		ios = isIosSafari();
	});

	const installReady = $derived(
		Boolean(pwaCtx?.state.installAvailable) || Boolean(getInstallPromptEvent())
	);

	async function install() {
		if (pwaCtx) {
			await pwaCtx.installApp();
		} else {
			await promptInstall();
		}
	}
</script>

{#if !standalone}
	<Card.Root id="install-app" class="scroll-mt-24 overflow-hidden border-primary/15">
		<Card.Header class="flex flex-row items-start gap-3 space-y-0 pb-2">
			<span
				class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
				aria-hidden="true"
			>
				<Smartphone class="size-5" />
			</span>
			<div class="min-w-0 flex-1 space-y-1">
				<Card.Title>Install app</Card.Title>
				{#if ios}
					<p class="text-sm text-muted-foreground">
						In Safari, tap Share, then Add to Home Screen.
					</p>
				{:else if installReady}
					<p class="text-sm text-muted-foreground">
						Install {APP_NAME} for quick access and offline reading.
					</p>
				{:else}
					<p class="text-sm text-muted-foreground">
						Use Chrome or Edge on desktop or Android. The install banner may appear
						while you browse.
					</p>
				{/if}
			</div>
		</Card.Header>
		{#if !ios && installReady}
			<Card.Content class="pt-0">
				<Button type="button" class="w-full sm:w-auto" onclick={() => void install()}>Install</Button>
			</Card.Content>
		{/if}
	</Card.Root>
{/if}
