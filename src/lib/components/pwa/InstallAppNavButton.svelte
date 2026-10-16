<script lang="ts">
	import { getContext } from 'svelte';
	import { cn } from '$lib/utils';
	import { APP_NAME } from '$lib/brand';
	import { isIosBrowser } from '$lib/pwa/install';
	import { installUiAvailable, runInstallAction } from '$lib/pwa/run-install';
	import { PWA_CONTEXT_KEY, type PwaContextValue } from '$lib/pwa/pwa-context';
	import InstallIosInstructionsModal from '$lib/components/pwa/InstallIosInstructionsModal.svelte';
	import { toast } from '$lib/toast';
	import { Smartphone } from 'lucide-svelte';

	type Variant = 'sidebar' | 'sheet';

	interface Props {
		variant?: Variant;
		collapsed?: boolean;
		class?: string;
		onAction?: () => void;
	}

	let { variant = 'sidebar', collapsed = false, class: className, onAction }: Props = $props();

	const pwaCtx = getContext<PwaContextValue | undefined>(PWA_CONTEXT_KEY);
	const ios = $derived(isIosBrowser());

	let iosHelpOpen = $state(false);
	let clientReady = $state(false);

	$effect(() => {
		clientReady = true;
	});

	const offerInstall = $derived(clientReady && installUiAvailable(pwaCtx));

	const hint = $derived(
		ios ? 'Share, then Add to Home Screen' : 'Opens from your home screen'
	);

	const primaryLabel = $derived(`Install ${APP_NAME}`);

	async function runInstall() {
		const result = await runInstallAction(pwaCtx);

		if (result === 'accepted') {
			onAction?.();
			return;
		}

		if (result === 'ios-help') {
			iosHelpOpen = true;
			onAction?.();
			return;
		}

		if (result === 'unavailable') {
			toast.error('Install is not available in this browser yet.');
		}

		onAction?.();
	}
</script>

{#if offerInstall}
	{#if variant === 'sheet'}
		<button
			type="button"
			class={cn(
				'native-press group flex min-h-[3.25rem] w-full items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2.5 text-left transition-colors active:bg-primary/15',
				className
			)}
			aria-label={`Install ${APP_NAME}`}
			onclick={() => void runInstall()}
		>
			<span
				class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
				aria-hidden="true"
			>
				<Smartphone class="size-[1.125rem]" strokeWidth={2} />
			</span>
			<span class="min-w-0 flex-1">
				<span class="block text-sm font-semibold leading-tight text-foreground">
					{primaryLabel}
				</span>
				<span class="mt-0.5 block text-xs leading-snug text-muted-foreground">{hint}</span>
			</span>
		</button>
	{:else if collapsed}
		<button
			type="button"
			title={primaryLabel}
			class={cn(
				'flex h-11 w-full items-center justify-center rounded-xl bg-primary/15 text-primary transition-all duration-200 hover:bg-primary/20',
				className
			)}
			onclick={() => void runInstall()}
		>
			<Smartphone class="h-4 w-4" />
		</button>
	{:else}
		<button
			type="button"
			class={cn(
				'group flex min-h-11 w-full items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2.5 text-left transition-all duration-200 hover:bg-primary/15',
				className
			)}
			onclick={() => void runInstall()}
		>
			<span
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
				aria-hidden="true"
			>
				<Smartphone class="h-4 w-4" />
			</span>
			<span class="min-w-0 flex-1">
				<span class="block truncate text-sm font-semibold">{primaryLabel}</span>
				<span class="block truncate text-xs text-muted-foreground">{hint}</span>
			</span>
		</button>
	{/if}

	<InstallIosInstructionsModal open={iosHelpOpen} onOpenChange={(open) => (iosHelpOpen = open)} />
{/if}
