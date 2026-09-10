<script lang="ts">
	import { cn } from '$lib/utils';
	import { Ellipsis } from 'lucide-svelte';
	import type { AppNavItem } from '$lib/nav/app-nav';
	import { isNavActive } from '$lib/nav/app-nav';

	interface Props {
		pathname: string;
		primaryTabs: AppNavItem[];
		/** Visual highlight when More destinations (or sheet) are active. */
		moreActive?: boolean;
		/** Sheet open state for aria-expanded only. */
		moreOpen?: boolean;
		onMoreClick: () => void;
	}

	let {
		pathname,
		primaryTabs,
		moreActive = false,
		moreOpen = false,
		onMoreClick
	}: Props = $props();
</script>

<nav
	class="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,var(--safe-area-bottom))] lg:hidden"
	aria-label="Primary"
	style="padding-left: max(0.75rem, var(--safe-area-left)); padding-right: max(0.75rem, var(--safe-area-right));"
>
	<div
		class={cn(
			'mobile-floating-dock pointer-events-auto mx-auto flex items-stretch rounded-[1.75rem] border border-border/40 bg-background/88 py-1 ring-1 ring-black/[0.04] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/72 dark:ring-white/[0.08]',
			primaryTabs.length > 0 ? 'w-full max-w-lg' : 'w-auto min-w-[4.5rem] px-1'
		)}
	>
		<div
			class={cn(
				'flex min-w-0 items-stretch gap-0.5 px-1.5',
				primaryTabs.length > 0 ? 'w-full' : 'justify-center'
			)}
		>
			{#each primaryTabs as item (item.id)}
				{@const active = isNavActive(pathname, item.href) && !moreActive}
				<a
					href={item.href}
					data-sveltekit-preload-data="hover"
					data-sveltekit-preload-code="hover"
					aria-current={active ? 'page' : undefined}
					class={cn(
						'native-press relative z-[1] flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1rem] px-1 py-1 transition-colors duration-150',
						active
							? 'bg-primary text-primary-foreground shadow-[var(--shadow-native-primary)]'
							: 'text-muted-foreground'
					)}
				>
					<item.icon class="size-[18px] shrink-0" strokeWidth={1.75} />
					<span
						class={cn(
							'w-full truncate px-0.5 text-center text-[10px] leading-none tracking-tight',
							active ? 'font-semibold' : 'font-medium'
						)}
					>
						{item.title}
					</span>
				</a>
			{/each}
			<button
				type="button"
				class={cn(
					'native-press relative z-[1] flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[1rem] px-1 py-1 transition-colors duration-150',
					primaryTabs.length > 0 ? 'min-w-0 flex-1' : 'w-[3.75rem] shrink-0',
					moreActive
						? 'bg-primary text-primary-foreground shadow-[var(--shadow-native-primary)]'
						: 'text-muted-foreground'
				)}
				aria-label="More"
				aria-haspopup="dialog"
				aria-expanded={moreOpen}
				onclick={onMoreClick}
			>
				<Ellipsis class="size-[18px] shrink-0" strokeWidth={1.75} />
				<span
					class={cn(
						'w-full truncate px-0.5 text-center text-[10px] leading-none tracking-tight',
						moreActive ? 'font-semibold' : 'font-medium'
					)}
				>
					More
				</span>
			</button>
		</div>
	</div>
</nav>
