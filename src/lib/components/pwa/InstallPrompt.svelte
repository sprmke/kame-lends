<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { dismissInstallPrompt, isIosSafari, shouldShowInstallPrompt } from '$lib/pwa/install';
	import { isStandaloneDisplay } from '$lib/pwa/capabilities';
	import { X } from 'lucide-svelte';
	import { APP_NAME } from '$lib/brand';

	interface Props {
		installAvailable: boolean;
		onInstall?: () => void | Promise<void>;
	}

	let { installAvailable, onInstall }: Props = $props();

	let dismissed = $state(false);
	const ios = $derived(isIosSafari());

	const visible = $derived(
		!dismissed &&
			!isStandaloneDisplay() &&
			shouldShowInstallPrompt() &&
			(installAvailable || ios)
	);

	function close() {
		dismissInstallPrompt();
		dismissed = true;
	}
</script>

{#if visible}
	<div
		class="fixed inset-x-4 z-[45] rounded-2xl border border-border/60 bg-card p-4 shadow-lg bottom-[calc(5.5rem+var(--safe-area-bottom))] lg:inset-x-auto lg:right-4 lg:bottom-4 lg:max-w-sm"
		role="dialog"
		aria-label="Install app"
	>
		<div class="flex items-start gap-3">
			<div class="min-w-0 flex-1">
				<p class="text-sm font-semibold">Install {APP_NAME}</p>
				{#if ios}
					<p class="mt-1 text-sm text-muted-foreground">
						Tap Share, then Add to Home Screen.
					</p>
				{:else}
					<p class="mt-1 text-sm text-muted-foreground">Open from your home screen.</p>
				{/if}
			</div>
			<button
				type="button"
				class="touch-target inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
				aria-label="Dismiss"
				onclick={close}
			>
				<X class="h-4 w-4" />
			</button>
		</div>
		{#if !ios && onInstall}
			<Button type="button" class="mt-3 w-full" onclick={() => void onInstall()}>Install</Button>
		{/if}
	</div>
{/if}
