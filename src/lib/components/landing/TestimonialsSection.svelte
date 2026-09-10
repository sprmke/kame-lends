<script lang="ts">
	import { Quote, Star } from 'lucide-svelte';
	import ScrollReveal from './ScrollReveal.svelte';

	const testimonials = [
		{
			quote:
				'Finally a system that understands collateral-backed loans. We replaced three spreadsheets in the first week.',
			name: 'Rico M.',
			role: 'Lending Operator, Cebu'
		},
		{
			quote:
				'The dashboard alerts alone saved us from missing past-due collections. Worth every minute.',
			name: 'Patricia L.',
			role: 'Operations Manager'
		},
		{
			quote: 'Investor tracking used to be a nightmare. Now I can show returns in seconds.',
			name: 'James T.',
			role: 'Multi-branch Operator'
		}
	];
</script>

<section id="testimonials" class="scroll-mt-24 bg-muted/25 py-24 sm:py-32">
	<div class="mx-auto max-w-7xl px-5 sm:px-8">
		<ScrollReveal class="mx-auto max-w-2xl text-center">
			<p class="section-eyebrow">Testimonials</p>
			<h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">What operators are saying</h2>
			<div class="mt-4 flex items-center justify-center gap-1">
				{#each Array.from({ length: 5 }) as _, i}
					<Star class="h-5 w-5 fill-primary text-primary" />
				{/each}
				<span class="ml-2 text-sm font-medium text-muted-foreground">
					Loved by lending professionals
				</span>
			</div>
		</ScrollReveal>

		<div class="mt-14 grid gap-6 md:grid-cols-3">
			{#each testimonials as t, i}
				<ScrollReveal delay={i * 100}>
					<figure
						class="flex h-full flex-col rounded-3xl border border-border/50 bg-card p-8 shadow-[var(--shadow-elevated)]"
					>
						<Quote class="h-8 w-8 text-primary/40" />
						<blockquote class="mt-4 flex-1 text-base leading-relaxed text-foreground">
							"{t.quote}"
						</blockquote>
						<figcaption class="mt-6 border-t border-border/40 pt-6">
							<p class="font-semibold">{t.name}</p>
							<p class="text-sm text-muted-foreground">{t.role}</p>
						</figcaption>
					</figure>
				</ScrollReveal>
			{/each}
		</div>
	</div>
</section>
