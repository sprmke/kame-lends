<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ArrowRight, CheckCircle2 } from 'lucide-svelte';
	import { APP_NAME } from '$lib/brand';
	import ScrollReveal from './ScrollReveal.svelte';
	import WorkflowShowcase from './WorkflowShowcase.svelte';

	const points = [
		'Create loans with investor splits in minutes',
		'Calendar view for sent, due, and interest dates',
		'Track interest periods and payments per loan',
		'Export and back up your data anytime'
	];
</script>

<section id="philosophy" class="scroll-mt-24 py-24 sm:py-32">
	<div class="mx-auto max-w-7xl px-5 sm:px-8">
		<div class="grid items-center gap-16 lg:grid-cols-2">
			<ScrollReveal direction="right" class="order-2 lg:order-1">
				<WorkflowShowcase />
			</ScrollReveal>

			<div class="order-1 lg:order-2">
				<ScrollReveal>
					<p class="section-eyebrow">Why {APP_NAME}</p>
					<h2 class="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
						Your trusted partner for lending operations
					</h2>
					<p class="mt-6 text-lg leading-relaxed text-muted-foreground">
						We built {APP_NAME} because generic tools don't understand Lot Title loans, investor splits,
						or the pace of a busy lending desk. You get software that speaks your language.
					</p>
				</ScrollReveal>

				<ScrollReveal delay={150}>
					<ul class="mt-10 space-y-4">
						{#each points as point}
							<li class="flex items-start gap-3">
								<CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0 text-primary" />
								<span class="text-muted-foreground">{point}</span>
							</li>
						{/each}
					</ul>
				</ScrollReveal>

				<ScrollReveal delay={250}>
					<Button href="/signin" size="lg" class="group mt-10 rounded-2xl px-8">
						Start managing smarter
						<ArrowRight class="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
					</Button>
				</ScrollReveal>
			</div>
		</div>
	</div>
</section>
