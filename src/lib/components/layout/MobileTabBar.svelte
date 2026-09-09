<script lang="ts">
	import { cn } from '$lib/utils';
	import { Ellipsis } from 'lucide-svelte';
	import type { AppNavItem } from '$lib/nav/app-nav';
	import { isNavActive } from '$lib/nav/app-nav';

	interface Props {
		pathname: string;
		primaryTabs: AppNavItem[];
		moreActive?: boolean;
		onMoreClick: () => void;
	}

	let { pathname, primaryTabs, moreActive = false, onMoreClick }: Props = $props();
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 pb-safe backdrop-blur-md lg:hidden"
	aria-label="Primary"
	style="padding-left: var(--safe-area-left); padding-right: var(--safe-area-right);"
>
	<div class="mx-auto flex h-[var(--mobile-tab-height)] max-w-lg items-stretch justify-around px-1">
		{#each primaryTabs as item (item.id)}
			{@const active = isNavActive(pathname, item.href)}
			<a
				href={item.href}
				data-sveltekit-preload-data="hover"
				data-sveltekit-preload-code="hover"
				aria-current={active ? 'page' : undefined}
				class={cn(
					'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors',
					active ? 'text-primary' : 'text-muted-foreground'
				)}
			>
				<div
					class={cn(
						'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
						active ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
					)}
				>
					<item.icon class="h-5 w-5" />
				</div>
				<span class="truncate">{item.title}</span>
			</a>
		{/each}
		<button
			type="button"
			class={cn(
				'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors',
				moreActive ? 'text-primary' : 'text-muted-foreground'
			)}
			aria-label="More"
			aria-expanded={moreActive}
			onclick={onMoreClick}
		>
			<div
				class={cn(
					'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
					moreActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
				)}
			>
				<Ellipsis class="h-5 w-5" />
			</div>
			<span>More</span>
		</button>
	</div>
</nav>
