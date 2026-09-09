<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { Menu, X } from 'lucide-svelte';

	const links = [
		{ href: '#features', label: 'Features' },
		{ href: '#showcase', label: 'Product' },
		{ href: '#philosophy', label: 'Why Us' },
		{ href: '#testimonials', label: 'Reviews' }
	];

	let scrolled = $state(false);
	let mobileOpen = $state(false);

	$effect(() => {
		const onScroll = () => {
			scrolled = window.scrollY > 24;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	$effect(() => {
		document.body.style.overflow = mobileOpen ? 'hidden' : '';
		return () => {
			document.body.style.overflow = '';
		};
	});
</script>

<header
	class={cn(
		'fixed inset-x-0 top-0 z-50 transition-all duration-500',
		scrolled
			? 'border-b border-border/50 bg-background/75 py-3 shadow-sm backdrop-blur-xl'
			: 'bg-transparent py-5'
	)}
>
	<div class="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8">
		<a href="/" class="relative z-10">
			<Logo size="md" showIcon={true} />
		</a>

		<nav class="hidden items-center gap-8 md:flex">
			{#each links as link}
				<a
					href={link.href}
					class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<div class="hidden items-center gap-3 md:flex">
			<Button href="/signin" variant="ghost" size="sm" class="rounded-xl">Sign In</Button>
			<Button href="/signin" size="sm" class="rounded-xl px-5 shadow-[var(--shadow-soft)]">
				Get Started
			</Button>
		</div>

		<button
			type="button"
			class="touch-target relative z-10 inline-flex items-center justify-center rounded-xl border border-border/60 bg-card/80 md:hidden"
			onclick={() => (mobileOpen = !mobileOpen)}
			aria-label="Toggle menu"
		>
			{#if mobileOpen}
				<X class="h-5 w-5" />
			{:else}
				<Menu class="h-5 w-5" />
			{/if}
		</button>
	</div>
</header>

{#if mobileOpen}
	<div class="fixed inset-0 z-40 md:hidden">
		<div
			class="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
			onclick={() => (mobileOpen = false)}
			role="presentation"
		></div>
		<div
			class="absolute top-0 right-0 flex h-full w-[min(100%,320px)] flex-col border-l border-border/50 bg-card/98 p-6 pt-20 backdrop-blur-xl"
		>
			<nav class="flex flex-col gap-1">
				{#each links as link}
					<a
						href={link.href}
						onclick={() => (mobileOpen = false)}
						class="rounded-xl px-4 py-3 text-base font-medium text-foreground hover:bg-muted"
					>
						{link.label}
					</a>
				{/each}
			</nav>
			<div class="mt-auto flex flex-col gap-3 pt-8">
				<Button href="/signin" variant="outline" class="w-full rounded-xl">Sign In</Button>
				<Button href="/signin" class="w-full rounded-xl">Get Started</Button>
			</div>
		</div>
	</div>
{/if}
