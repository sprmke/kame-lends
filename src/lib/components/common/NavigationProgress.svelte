<script lang="ts">
	import { navigating } from '$app/state';

	const active = $derived(!!navigating?.to);
</script>

{#if active}
	<div
		class="nav-progress"
		role="progressbar"
		aria-label="Loading"
		aria-busy="true"
		aria-valuemin={0}
		aria-valuemax={100}
	></div>
{/if}

<style>
	.nav-progress {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 100;
		height: 2px;
		width: 100%;
		overflow: hidden;
		pointer-events: none;
		background: color-mix(in oklab, var(--primary) 25%, transparent);
	}

	.nav-progress::after {
		content: '';
		display: block;
		height: 100%;
		width: 35%;
		border-radius: 999px;
		background: var(--primary);
		animation: nav-progress-slide 0.85s ease-in-out infinite;
	}

	@keyframes nav-progress-slide {
		0% {
			transform: translateX(-120%);
		}
		100% {
			transform: translateX(380%);
		}
	}
</style>
