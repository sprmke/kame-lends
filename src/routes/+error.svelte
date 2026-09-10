<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import Logo from '$lib/components/Logo.svelte';
	import { resolveErrorPresentation, type ErrorIconKind } from '$lib/error-presentation';
	import { Lock, LogIn, SearchX, TriangleAlert } from 'lucide-svelte';

	const presentation = $derived(
		resolveErrorPresentation({
			status: page.status,
			pathname: page.url.pathname,
			search: page.url.search,
			signedIn: Boolean(page.data.session?.user)
		})
	);

	const icons: Record<ErrorIconKind, typeof Lock> = {
		denied: Lock,
		missing: SearchX,
		signin: LogIn,
		crash: TriangleAlert
	};

	const iconTones: Record<ErrorIconKind, string> = {
		denied: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
		missing: 'bg-muted text-muted-foreground',
		signin: 'bg-primary/15 text-primary',
		crash: 'bg-destructive/15 text-destructive'
	};

	const Icon = $derived(icons[presentation.icon]);
	const isPublicSigningLink = $derived(page.url.pathname.startsWith('/sign/'));
</script>

<svelte:head><title>{presentation.title}</title></svelte:head>

<div
	class="flex min-h-[calc(100svh-7rem)] w-full flex-col items-center justify-center gap-6 px-4 py-10 sm:px-6"
>
	{#if isPublicSigningLink}
		<Logo size="md" showIcon={true} gradient={true} />
	{/if}

	<div
		class="w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 text-center sm:p-8"
		style="box-shadow: var(--shadow-elevated)"
	>
		<div
			class={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${iconTones[presentation.icon]}`}
		>
			<Icon class="h-6 w-6" />
		</div>

		<h1 class="mt-5 text-xl font-semibold tracking-tight text-balance sm:text-2xl">
			{presentation.title}
		</h1>
		<p class="mt-2 text-sm text-pretty text-muted-foreground">{presentation.detail}</p>

		<div class="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
			{#each presentation.actions as action (action.label)}
				{#if action.kind === 'link' && action.href}
					<Button
						href={action.href}
						variant={action.variant}
						class="w-full sm:w-auto sm:min-w-32"
					>
						{action.label}
					</Button>
				{:else if action.kind === 'back'}
					<Button
						type="button"
						variant={action.variant}
						class="w-full sm:w-auto sm:min-w-32"
						onclick={() => history.back()}
					>
						{action.label}
					</Button>
				{:else}
					<Button
						type="button"
						variant={action.variant}
						class="w-full sm:w-auto sm:min-w-32"
						onclick={() => location.reload()}
					>
						{action.label}
					</Button>
				{/if}
			{/each}
		</div>
	</div>
</div>
