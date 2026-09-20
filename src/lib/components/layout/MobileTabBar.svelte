<script lang="ts">
	import { cn } from '$lib/utils';
	import * as Avatar from '$lib/components/ui/avatar';
	import type { AppNavItem } from '$lib/nav/app-nav';
	import { isNavActive } from '$lib/nav/app-nav';
	import { Ellipsis } from 'lucide-svelte';

	interface Props {
		pathname: string;
		primaryTabs: AppNavItem[];
		/** Visual highlight when the More sheet is open or route is sheet-only. */
		moreActive?: boolean;
		/** Visual highlight on the profile control when on Settings. */
		settingsActive?: boolean;
		/** Sheet open state for aria-expanded only. */
		moreOpen?: boolean;
		userImage?: string | null;
		userInitials: string;
		onMoreClick: () => void;
		onTabNavigate?: (href: string) => void;
	}

	let {
		pathname,
		primaryTabs,
		moreActive = false,
		settingsActive = false,
		moreOpen = false,
		userImage = null,
		userInitials,
		onMoreClick,
		onTabNavigate
	}: Props = $props();

	const settingsHref = '/settings';
</script>

<nav
	class="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,var(--safe-area-bottom))] lg:hidden"
	aria-label="Primary"
	style="padding-left: max(0.75rem, var(--safe-area-left)); padding-right: max(0.75rem, var(--safe-area-right));"
>
	<div
		class={cn(
			'mobile-floating-dock pointer-events-auto mx-auto flex items-stretch rounded-[1.75rem] border border-border/40 bg-background py-1 ring-1 ring-black/[0.04] dark:ring-white/[0.08]',
			'w-full max-w-lg'
		)}
	>
		<div class="flex min-w-0 w-full items-stretch gap-0.5 px-1.5">
			{#each primaryTabs as item (item.id)}
				{@const active =
					isNavActive(pathname, item.href) && !moreActive && !settingsActive}
				<a
					href={item.href}
					data-sveltekit-preload-data="off"
					data-sveltekit-noscroll
					aria-current={active ? 'page' : undefined}
					class={cn(
						'native-press relative z-[1] flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1rem] px-1 py-1 transition-colors duration-150',
						active
							? 'bg-primary text-primary-foreground shadow-[var(--shadow-native-primary)]'
							: 'text-muted-foreground'
					)}
					onclick={() => onTabNavigate?.(item.href)}
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
					'native-press relative z-[1] flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1rem] px-1 py-1 transition-colors duration-150',
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
			<a
				href={settingsHref}
				data-sveltekit-preload-data="off"
				data-sveltekit-noscroll
				aria-current={settingsActive ? 'page' : undefined}
				aria-label="Settings"
				class={cn(
					'native-press relative z-[1] flex min-h-12 w-[3.5rem] shrink-0 items-center justify-center rounded-[1rem] px-1 py-1 transition-colors duration-150',
					settingsActive ? 'text-foreground' : 'text-muted-foreground'
				)}
				onclick={() => onTabNavigate?.(settingsHref)}
			>
				<span
					class={cn(
						'flex size-[26px] items-center justify-center rounded-full transition-[box-shadow] duration-150',
						settingsActive && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
					)}
				>
					<Avatar.Root class="size-[26px] after:hidden">
						<Avatar.Image src={userImage ?? undefined} alt="" />
						<Avatar.Fallback
							class="bg-primary text-[10px] font-semibold text-primary-foreground"
						>
							{userInitials}
						</Avatar.Fallback>
					</Avatar.Root>
				</span>
			</a>
		</div>
	</div>
</nav>
