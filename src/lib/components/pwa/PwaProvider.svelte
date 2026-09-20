<script lang="ts">
	import { setContext } from 'svelte';
	import { browser } from '$app/environment';
	import { createPwaState } from '$lib/pwa/pwa.svelte';
	import { PWA_CONTEXT_KEY, type PwaContextValue } from '$lib/pwa/pwa-context';
	import { initPwaRegistration, promptInstall } from '$lib/pwa/register';
	import { purgeOfflineState } from '$lib/pwa/purge';
	import { USER_ID_KEY } from '$lib/pwa/shared';
	import { resyncPushSubscription } from '$lib/pwa/push';
	import { OFFLINE_MUTATION_EVENT } from '$lib/pwa/offline-fetch';
	import { OFFLINE_ERROR_MESSAGE } from '$lib/pwa/shared';
	import { toast } from '$lib/toast';
	import OfflineBanner from '$lib/components/pwa/OfflineBanner.svelte';
	import InstallPrompt from '$lib/components/pwa/InstallPrompt.svelte';
	import UpdatePrompt from '$lib/components/pwa/UpdatePrompt.svelte';

	interface Props {
		userId?: string | null;
		children?: import('svelte').Snippet;
	}

	let { userId = null, children }: Props = $props();

	const pwa = createPwaState();
	let cleanup: (() => void) | null = null;

	async function installApp() {
		const accepted = await promptInstall();
		if (accepted) {
			pwa.installAvailable = false;
		}
	}

	setContext<PwaContextValue>(PWA_CONTEXT_KEY, {
		get state() {
			return pwa;
		},
		installApp
	});

	$effect(() => {
		if (!browser) return;
		const syncOffline = () => {
			pwa.offline = !navigator.onLine;
		};
		syncOffline();
		document.documentElement.dataset.pwaReady = '1';
		window.addEventListener('online', syncOffline);
		window.addEventListener('offline', syncOffline);
		return () => {
			delete document.documentElement.dataset.pwaReady;
			window.removeEventListener('online', syncOffline);
			window.removeEventListener('offline', syncOffline);
		};
	});

	$effect(() => {
		if (!browser) return;
		const onOfflineMutation = () => {
			toast.error(OFFLINE_ERROR_MESSAGE);
		};
		window.addEventListener(OFFLINE_MUTATION_EVENT, onOfflineMutation);
		return () => window.removeEventListener(OFFLINE_MUTATION_EVENT, onOfflineMutation);
	});

	$effect(() => {
		if (!browser || !import.meta.env.PROD) return;
		cleanup?.();
		cleanup = initPwaRegistration(pwa);
		return () => cleanup?.();
	});

	$effect(() => {
		if (!browser || !userId) return;
		const stored = localStorage.getItem(USER_ID_KEY);
		if (stored && stored !== userId) {
			void purgeOfflineState();
		}
		localStorage.setItem(USER_ID_KEY, userId);
	});

	$effect(() => {
		if (!browser) return;
		const onPushResync = () => void resyncPushSubscription();
		window.addEventListener('kl:push-resync', onPushResync);
		return () => window.removeEventListener('kl:push-resync', onPushResync);
	});

</script>

{#if children}
	{@render children()}
{/if}

<OfflineBanner offline={pwa.offline} />
<UpdatePrompt updateReady={pwa.updateReady} />
<InstallPrompt
	installAvailable={pwa.installAvailable && !pwa.updateReady}
	onInstall={installApp}
/>
