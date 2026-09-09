<script lang="ts">
	import LandingNav from './LandingNav.svelte';
	import HeroSection from './HeroSection.svelte';
	import LogoMarquee from './LogoMarquee.svelte';
	import AppShowcase from './AppShowcase.svelte';
	import FeaturesSection from './FeaturesSection.svelte';
	import FeaturesDarkSection from './FeaturesDarkSection.svelte';
	import PhilosophySection from './PhilosophySection.svelte';
	import TestimonialsSection from './TestimonialsSection.svelte';
	import CtaSection from './CtaSection.svelte';
	import MarqueeTicker from './MarqueeTicker.svelte';
	import LandingFooter from './LandingFooter.svelte';
</script>

<div class="landing-page min-h-screen overflow-x-hidden bg-background">
	<LandingNav />
	<HeroSection />
	<LogoMarquee />
	<AppShowcase />
	<FeaturesSection />
	<FeaturesDarkSection />
	<PhilosophySection />
	<TestimonialsSection />
	<CtaSection />
	<MarqueeTicker />
	<LandingFooter />
</div>
