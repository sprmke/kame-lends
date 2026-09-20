<script lang="ts">
	import { getContext } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		dismissInstallPrompt,
		isIosSafari,
		shouldShowInstallPrompt
	} from '$lib/pwa/install';
	import { isStandaloneDisplay } from '$lib/pwa/capabilities';
	import { runInstallAction } from '$lib/pwa/run-install';
	import { PWA_CONTEXT_KEY, type PwaContextValue } from '$lib/pwa/pwa-context';
	import InstallIosInstructionsModal from '$lib/components/pwa/InstallIosInstructionsModal.svelte';
	import { toast } from '$lib/toast';
	import { Download, X } from 'lucide-svelte';
	import { APP_NAME } from '$lib/brand';

	interface Props {
		installAvailable: boolean;
	}

	let { installAvailable }: Props = $props();

	const pwaCtx = getContext<PwaContextValue | undefined>(PWA_CONTEXT_KEY);

	let dismissed = $state(false);
	let iosHelpOpen = $state(false);
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

	async function handleInstall() {
		const result = await runInstallAction(pwaCtx);
		if (result === 'ios-help') {
			iosHelpOpen = true;
			return;
		}
		if (result === 'accepted') {
			close();
			return;
		}
		if (result === 'unavailable') {
			toast.error('Install is not available in this browser yet.');
		}
	}
</script>

{#if visible}
	<div
		class="fixed inset-x-4 z-[45] rounded-2xl border border-primary/20 bg-card p-4 shadow-lg bottom-[calc(5.5rem+var(--safe-area-bottom))] lg:inset-x-auto lg:right-4 lg:bottom-4 lg:max-w-sm"
		role="dialog"
		aria-label="Install app"
	>
		<div class="flex items-start gap-3">
			<span
				class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
				aria-hidden="true"
			>
				<Download class="h-5 w-5" />
			</span>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-semibold">Install {APP_NAME}</p>
				{#if ios}
					<p class="mt-1 text-sm text-muted-foreground">
						Tap Install for Add to Home Screen steps.
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
		<Button type="button" class="mt-3 w-full" onclick={() => void handleInstall()}>Install</Button>
	</div>

	<InstallIosInstructionsModal open={iosHelpOpen} onOpenChange={(open) => (iosHelpOpen = open)} />
{/if}
