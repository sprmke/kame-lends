<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import { Button } from '$lib/components/ui/button';
	import { ArrowRight } from 'lucide-svelte';
	import { APP_NAME } from '$lib/brand';
	import { SHOW_TRANSACTIONS_UI } from '$lib/feature-flags';

	const navigateLinks = [
		{ href: '#features', label: 'Features' },
		{ href: '#showcase', label: 'Product' },
		{ href: '#philosophy', label: 'Why Us' },
		{ href: '#testimonials', label: 'Reviews' }
	];
</script>

<footer class="border-t border-border/50 bg-muted/20">
	<div class="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
		<div class="grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-12">
			<div class="lg:col-span-5">
				<Logo size="lg" showIcon={true} />
				<p class="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
					Professional lending management. Track loans, investors, and
					{SHOW_TRANSACTIONS_UI ? 'transactions' : 'borrowings'} in one modern platform.
				</p>
				<Button href="/signin" class="group mt-6 rounded-2xl shadow-[var(--shadow-soft)]">
					Get Started
					<ArrowRight class="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
				</Button>
			</div>

			<div class="grid gap-8 sm:grid-cols-2 lg:col-span-4 lg:col-start-8">
				<div>
					<p class="text-xs font-semibold tracking-wider text-foreground uppercase">Navigate</p>
					<ul class="mt-4 flex flex-col gap-2.5">
						{#each navigateLinks as link}
							<li>
								<a
									href={link.href}
									class="text-sm text-muted-foreground transition-colors hover:text-primary"
								>
									{link.label}
								</a>
							</li>
						{/each}
					</ul>
				</div>
				<div>
					<p class="text-xs font-semibold tracking-wider text-foreground uppercase">Account</p>
					<ul class="mt-4 flex flex-col gap-2.5">
						<li>
							<a
								href="/signin"
								class="text-sm text-muted-foreground transition-colors hover:text-primary"
							>
								Sign In
							</a>
						</li>
					</ul>
				</div>
			</div>
		</div>

		<div class="mt-12 border-t border-border/40 pt-8">
			<p class="text-center text-sm text-muted-foreground sm:text-left">
				&copy; {new Date().getFullYear()}
				{APP_NAME}. All rights reserved.
			</p>
		</div>
	</div>
</footer>
