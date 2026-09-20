<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils';
	import { APP_NAME } from '$lib/brand';
	import { isStandaloneDisplay } from '$lib/pwa/capabilities';
	import { isIosSafari } from '$lib/pwa/install';
	import { getInstallPromptEvent, promptInstall } from '$lib/pwa/register';
	import { PWA_CONTEXT_KEY, type PwaContextValue } from '$lib/pwa/pwa-context';
	import { ChevronRight, Download, Smartphone } from 'lucide-svelte';

	type Variant = 'sidebar' | 'sheet';

	interface Props {
		variant?: Variant;
		collapsed?: boolean;
		class?: string;
		onAction?: () => void;
	}

	let { variant = 'sidebar', collapsed = false, class: className, onAction }: Props = $props();

	const pwaCtx = getContext<PwaContextValue | undefined>(PWA_CONTEXT_KEY);
	const standalone = $derived(isStandaloneDisplay());
	const ios = $derived(isIosSafari());

	const installReady = $derived(
		Boolean(pwaCtx?.state.installAvailable) || Boolean(getInstallPromptEvent())
	);

	const hint = $derived(
		installReady
			? 'Opens from your home screen'
			: ios
				? 'Share, then Add to Home Screen'
				: 'Steps in Settings'
	);

	async function runInstall() {
		if (installReady) {
			if (pwaCtx) {
				await pwaCtx.installApp();
			} else {
				await promptInstall();
			}
			onAction?.();
			return;
		}
		onAction?.();
		await goto('/settings#install-app');
	}
</script>

{#if !standalone}
	{#if variant === 'sheet'}
		<button
			type="button"
			class={cn(
				'native-press group flex min-h-[3.25rem] w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors',
				installReady
					? 'border-primary/25 bg-primary/10 active:bg-primary/15'
					: 'border-border/60 bg-muted/30 active:bg-muted/50',
				className
			)}
			aria-label={installReady ? `Install ${APP_NAME}` : 'Install app, see steps in Settings'}
			onclick={() => void runInstall()}
		>
			<span
				class={cn(
					'flex size-10 shrink-0 items-center justify-center rounded-xl',
					installReady
						? 'bg-primary text-primary-foreground shadow-sm'
						: 'bg-muted text-foreground'
				)}
				aria-hidden="true"
			>
				{#if installReady}
					<Smartphone class="size-[1.125rem]" strokeWidth={2} />
				{:else}
					<Download class="size-[1.125rem]" strokeWidth={2} />
				{/if}
			</span>
			<span class="min-w-0 flex-1">
				<span class="block text-sm font-semibold leading-tight text-foreground">
					{installReady ? `Install ${APP_NAME}` : 'Install app'}
				</span>
				<span class="mt-0.5 block text-xs leading-snug text-muted-foreground">{hint}</span>
			</span>
			<ChevronRight
				class="size-4 shrink-0 text-muted-foreground transition-transform group-active:translate-x-0.5"
				aria-hidden="true"
			/>
		</button>
	{:else if collapsed}
		<button
			type="button"
			title={installReady ? `Install ${APP_NAME}` : 'Install app'}
			class={cn(
				'relative flex h-11 w-full items-center justify-center rounded-xl transition-all duration-200',
				installReady
					? 'bg-primary/15 text-primary hover:bg-primary/20'
					: 'text-muted-foreground hover:bg-accent hover:text-foreground',
				className
			)}
			onclick={() => void runInstall()}
		>
			<Smartphone class="h-4 w-4" />
			{#if installReady}
				<span
					class="absolute top-2 right-2 size-2 rounded-full bg-primary ring-2 ring-card"
					aria-hidden="true"
				></span>
			{/if}
		</button>
	{:else}
		<button
			type="button"
			class={cn(
				'group flex min-h-11 w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200',
				installReady
					? 'border-primary/25 bg-primary/10 hover:bg-primary/15'
					: 'border-border/50 bg-muted/40 hover:bg-muted/60',
				className
			)}
			onclick={() => void runInstall()}
		>
			<span
				class={cn(
					'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
					installReady ? 'bg-primary text-primary-foreground' : 'bg-muted/80 text-foreground'
				)}
				aria-hidden="true"
			>
				<Smartphone class="h-4 w-4" />
			</span>
			<span class="min-w-0 flex-1">
				<span class="block truncate text-sm font-semibold">
					{installReady ? 'Install now' : 'Install app'}
				</span>
				<span class="block truncate text-xs text-muted-foreground">{hint}</span>
			</span>
			<ChevronRight
				class="h-4 w-4 shrink-0 text-muted-foreground opacity-70 group-hover:opacity-100"
				aria-hidden="true"
			/>
		</button>
	{/if}
{/if}
