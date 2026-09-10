<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ArrowRight, Play, Sparkles } from 'lucide-svelte';
	import HeroFloatingAccents from './HeroFloatingAccents.svelte';
	import DashboardPreview from './mockups/DashboardPreview.svelte';
	import ScrollReveal from './ScrollReveal.svelte';
	import { APP_NAME } from '$lib/brand';
	import { SHOW_TRANSACTIONS_UI } from '$lib/feature-flags';
</script>

<section class="landing-hero relative overflow-x-hidden pt-28 pb-16 sm:pb-24 lg:pb-32">
	<div class="landing-mesh pointer-events-none absolute inset-0 -z-10"></div>

	<div class="mx-auto max-w-7xl px-5 sm:px-8">
		<div class="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
			<div>
				<ScrollReveal>
					<div
						class="landing-shimmer-badge mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-2 text-sm font-medium text-primary"
					>
						<Sparkles class="h-4 w-4" />
						Built for modern lending teams
					</div>
				</ScrollReveal>

				<ScrollReveal delay={100}>
					<h1
						class="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-[3.5rem] xl:leading-[1.08]"
					>
						Manage lending with <span class="landing-gradient-text">clarity</span> and control
					</h1>
				</ScrollReveal>

				<ScrollReveal delay={200}>
					<p class="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
						{APP_NAME} unifies loans, investors, and
						{SHOW_TRANSACTIONS_UI ? 'transactions' : 'borrowings'} in one beautiful system, so always
						know what's due, what's collected, and what's next.
					</p>
				</ScrollReveal>

				<ScrollReveal delay={300}>
					<div class="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
						<Button
							href="/signin"
							size="lg"
							class="group h-12 rounded-2xl px-8 text-base shadow-[var(--shadow-soft)]"
						>
							Get Started Free
							<ArrowRight class="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
						</Button>
						<Button
							href="#showcase"
							size="lg"
							variant="outline"
							class="h-12 rounded-2xl border-border/60 px-8 text-base"
						>
							<Play class="mr-2 h-4 w-4 fill-primary text-primary" />
							See the App
						</Button>
					</div>
				</ScrollReveal>
			</div>

			<ScrollReveal delay={200} direction="left" class="relative">
				<div class="relative mx-auto w-full max-w-xl overflow-visible px-3 sm:px-5 lg:max-w-none">
					<div class="landing-orb landing-orb-1"></div>
					<div class="landing-orb landing-orb-2"></div>
					<div class="animate-float relative z-10 overflow-visible">
						<DashboardPreview />
						<HeroFloatingAccents />
					</div>
				</div>
			</ScrollReveal>
		</div>
	</div>
</section>
