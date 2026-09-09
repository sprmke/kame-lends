import { cubicOut } from 'svelte/easing';

export const CHART_HEIGHT = 280;
export const PIE_SIZE = 220;

export const CHART_PALETTE = {
	primary: '#e8850c',
	teal: '#34b39a',
	coral: '#dc6b6b',
	violet: '#7c6dcb',
	gold: '#d4a535'
};

function prefersReducedMotion(): boolean {
	return (
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

export function chartEnterMotion() {
	if (prefersReducedMotion()) return 'none' as const;
	return { type: 'tween' as const, duration: 700, easing: cubicOut };
}

function chartTooltipMotion() {
	if (prefersReducedMotion()) return 'none' as const;
	return { type: 'tween' as const, duration: 180 };
}

export const CHART_TOOLTIP_ROOT = {
	variant: 'none' as const,
	classes: {
		container: 'chart-tooltip'
	},
	motion: chartTooltipMotion()
};
