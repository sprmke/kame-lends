<script lang="ts">
	import { onMount } from 'svelte';
	import { Moon, Sun } from 'lucide-svelte';
	import { mode, setMode, toggleMode, userPrefersMode } from 'mode-watcher';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
		/** Compact header control, or Light/Dark pill. */
		variant?: 'icon' | 'segmented';
	}

	let { class: className, variant = 'icon' }: Props = $props();

	let mounted = $state(false);

	onMount(() => {
		mounted = true;
	});

	const resolved = $derived(mode.current);
	const preference = $derived(userPrefersMode.current);
	const isDark = $derived(mounted && resolved === 'dark');
	const activeValue = $derived(
		preference === 'system' ? (resolved === 'dark' ? 'dark' : 'light') : preference
	);

	const options = [
		{ value: 'light' as const, label: 'Light', Icon: Sun },
		{ value: 'dark' as const, label: 'Dark', Icon: Moon }
	];
</script>

{#if variant === 'segmented'}
	<div
		class={cn(
			'flex w-full rounded-xl border border-border/60 bg-muted/70 p-0.5 shadow-[var(--shadow-elevated)]',
			className
		)}
		role="group"
		aria-label="Theme"
	>
		{#each options as { value, label, Icon } (value)}
			{@const active = activeValue === value}
			<button
				type="button"
				onclick={() => setMode(value)}
				aria-pressed={active}
				aria-label={label}
				title={label}
				class={cn(
					'relative flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors duration-150',
					'focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
					'motion-reduce:transition-none',
					active
						? 'bg-card text-foreground shadow-[var(--shadow-elevated)]'
						: 'text-muted-foreground hover:text-foreground'
				)}
			>
				<Icon class="size-3.5 shrink-0" aria-hidden="true" />
				<span>{label}</span>
			</button>
		{/each}
	</div>
{:else}
	<button
		type="button"
		onclick={toggleMode}
		disabled={!mounted}
		class={cn(
			'relative inline-flex size-11 min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground shadow-[var(--shadow-elevated)]',
			'transition-colors duration-150 hover:bg-muted hover:text-foreground',
			'focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
			'motion-reduce:transition-none disabled:opacity-60',
			className
		)}
		aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
		title={isDark ? 'Light mode' : 'Dark mode'}
	>
		<Sun
			class={cn(
				'size-4 transition-all duration-150 motion-reduce:transition-none',
				isDark ? 'rotate-0 scale-100' : 'rotate-90 scale-0'
			)}
			aria-hidden="true"
		/>
		<Moon
			class={cn(
				'absolute size-4 transition-all duration-150 motion-reduce:transition-none',
				isDark ? 'rotate-90 scale-0' : 'rotate-0 scale-100'
			)}
			aria-hidden="true"
		/>
	</button>
{/if}
