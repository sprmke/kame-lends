<script lang="ts">
	import { Eye, Layers, Zap } from 'lucide-svelte';
	import ScrollReveal from './ScrollReveal.svelte';

	const principles = [
		{
			icon: Layers,
			title: 'Simplicity',
			description: 'One dashboard for your whole operation. No clutter, no learning curve.'
		},
		{
			icon: Eye,
			title: 'Visibility',
			description: 'Toggle prices on or off for privacy. Full amounts when you need them.'
		},
		{
			icon: Zap,
			title: 'Speed',
			description: 'Record loans and borrowings in seconds. Spend time growing, not typing.'
		}
	];
</script>

<section class="landing-dark-section relative overflow-hidden py-24 sm:py-32">
	<div class="landing-dark-mesh pointer-events-none absolute inset-0"></div>
	<div class="relative mx-auto max-w-7xl px-5 sm:px-8">
		<ScrollReveal class="mx-auto max-w-3xl text-center">
			<p class="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
				Guiding Principles
			</p>
			<h2 class="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
				Built the way lending teams actually work
			</h2>
		</ScrollReveal>

		<div class="mt-16 grid gap-6 md:grid-cols-3">
			{#each principles as item, i}
				<ScrollReveal delay={i * 100}>
					<div
						class="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-colors duration-300 hover:border-primary/40 hover:bg-white/8"
					>
						<div
							class="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary"
						>
							<item.icon class="h-7 w-7" />
						</div>
						<h3 class="text-xl font-semibold text-white">{item.title}</h3>
						<p class="mt-3 text-sm leading-relaxed text-white/65">{item.description}</p>
					</div>
				</ScrollReveal>
			{/each}
		</div>
	</div>
</section>
