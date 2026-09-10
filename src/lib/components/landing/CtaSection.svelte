<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ArrowRight } from 'lucide-svelte';
	import ScrollReveal from './ScrollReveal.svelte';
	import { SHOW_TRANSACTIONS_UI } from '$lib/feature-flags';
</script>

<section class="py-24 sm:py-32">
	<div class="mx-auto max-w-7xl px-5 sm:px-8">
		<ScrollReveal>
			<div
				class="landing-cta-banner relative isolate overflow-hidden rounded-[2rem] px-8 py-20 sm:px-16 sm:py-24"
			>
				<div class="landing-cta-orbs pointer-events-none absolute inset-0"></div>
				<div class="relative mx-auto max-w-2xl text-center">
					<h2
						class="text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl"
					>
						Ready to take control of your lending operation?
					</h2>
					<p class="mx-auto mt-6 max-w-lg text-lg text-white/85">
						Join operators who run smarter with loans, investors, and
						{SHOW_TRANSACTIONS_UI ? 'transactions' : 'borrowings'} in one place.
					</p>
					<div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
						<Button
							href="/signin"
							size="lg"
							variant="secondary"
							class="group h-12 rounded-2xl px-8 text-base shadow-lg"
						>
							Sign In to Get Started
							<ArrowRight class="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
						</Button>
					</div>
				</div>
			</div>
		</ScrollReveal>
	</div>
</section>
