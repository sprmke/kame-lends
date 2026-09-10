<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { cn } from '$lib/utils';
	import BrandIcon from '$lib/components/BrandIcon.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import ThemeToggle from '$lib/components/theme/ThemeToggle.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Avatar from '$lib/components/ui/avatar';
	import MobileTabBar from '$lib/components/layout/MobileTabBar.svelte';
	import MobileTopBar from '$lib/components/layout/MobileTopBar.svelte';
	import MobileHeroActions from '$lib/components/layout/MobileHeroActions.svelte';
	import MobileMoreSheet from '$lib/components/layout/MobileMoreSheet.svelte';
	import {
		buildAppNav,
		DEFAULT_NAV_CAPABILITIES,
		isNavActive,
		resolveMobileDockHighlight,
		type NavCapabilities
	} from '$lib/nav/app-nav';
	import { THEME_COLOR_DASHBOARD } from '$lib/theme/preferences';
	import { ChevronLeft, ChevronRight, LogOut } from 'lucide-svelte';

	interface UserInfo {
		name?: string | null;
		email?: string | null;
		image?: string | null;
	}

	interface Props {
		user?: UserInfo | null;
		navCapabilities?: NavCapabilities | null;
		children: Snippet;
	}

	let { user = null, navCapabilities = null, children }: Props = $props();

	let isCollapsed = $state(false);
	let moreOpen = $state(false);

	const caps = $derived(navCapabilities ?? DEFAULT_NAV_CAPABILITIES);
	const nav = $derived(buildAppNav(caps));

	const pathname = $derived(page.url.pathname);
	const isLandingPage = $derived(!user && pathname === '/');
	const isSignInPage = $derived(!user && pathname === '/signin');
	const isSignPage = $derived(pathname.startsWith('/sign/'));
	const isPublicChromeless = $derived(isLandingPage || isSignInPage || isSignPage);

	const { moreActive } = $derived(
		resolveMobileDockHighlight(pathname, nav.primaryTabs, nav.moreNavItems, moreOpen)
	);

	$effect(() => {
		void pathname;
		moreOpen = false;
	});

	const userInitials = $derived(
		user?.name
			? user.name
					.split(' ')
					.map((n) => n[0])
					.join('')
					.toUpperCase()
			: (user?.email?.[0]?.toUpperCase() ?? 'U')
	);
</script>

<svelte:head>
	{#if user && !isPublicChromeless}
		<meta name="theme-color" content={THEME_COLOR_DASHBOARD} />
		<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	{/if}
</svelte:head>

{#if user && !isPublicChromeless}
	<MobileTopBar>
		{#snippet actions()}
			<MobileHeroActions />
		{/snippet}
	</MobileTopBar>

	<MobileTabBar
		{pathname}
		primaryTabs={nav.primaryTabs}
		{moreActive}
		{moreOpen}
		onMoreClick={() => (moreOpen = true)}
	/>

	<MobileMoreSheet
		open={moreOpen}
		onOpenChange={(open) => (moreOpen = open)}
		{pathname}
		moreNavItems={nav.moreNavItems}
		{user}
	/>

	<aside
		class={cn(
			'fixed top-4 left-4 z-40 hidden h-[calc(100vh-2rem)] flex-col rounded-[1.75rem] border border-border/50 bg-card/95 shadow-[var(--shadow-elevated-lg)] backdrop-blur-xl transition-all duration-300 lg:flex',
			isCollapsed ? 'w-[5.5rem]' : 'w-[17rem]'
		)}
	>
		<div
			class={cn(
				'flex h-16 shrink-0 items-center border-b border-border/50',
				isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
			)}
		>
			{#if !isCollapsed}
				<a href="/dashboard"
					><Logo size="md" showIcon={true} gradient={true} animated={true} /></a
				>
			{:else}
				<a href="/dashboard" class="flex w-full justify-center" title="Dashboard">
					<BrandIcon size="lg" />
				</a>
			{/if}
			<button
				type="button"
				class={cn(
					'flex h-8 w-8 items-center justify-center rounded-xl bg-muted/80 text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground',
					isCollapsed &&
						'absolute top-5 -right-3.5 border border-border/50 bg-card shadow-[var(--shadow-elevated)]'
				)}
				aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				onclick={() => (isCollapsed = !isCollapsed)}
			>
				{#if isCollapsed}<ChevronRight class="h-3.5 w-3.5" />{:else}<ChevronLeft
						class="h-3.5 w-3.5"
					/>{/if}
			</button>
		</div>
		<nav class={cn('flex-1 space-y-1.5 overflow-y-auto', isCollapsed ? 'p-2.5' : 'p-4')}>
			{#each nav.sidebarItems as item (item.id)}
				<a
					href={item.href}
					data-sveltekit-preload-data="hover"
					data-sveltekit-preload-code="hover"
					title={isCollapsed ? item.title : undefined}
					class={cn(
						'group relative mb-0.5 flex items-center rounded-2xl py-2.5 text-sm font-medium transition-all duration-200',
						isNavActive(pathname, item.href)
							? 'nav-item-active'
							: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
						isCollapsed ? 'justify-center px-2' : 'gap-3 px-3.5'
					)}
				>
					<div
						class={cn(
							'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200',
							isNavActive(pathname, item.href)
								? 'nav-item-active-icon'
								: 'bg-muted/80 group-hover:bg-primary/10'
						)}
					>
						<item.icon class="h-4 w-4" />
					</div>
					{#if !isCollapsed}<span class="truncate font-medium">{item.title}</span>{/if}
				</a>
			{/each}
		</nav>
		<div class="border-t border-border/50 p-4">
			<div class={cn('mb-3', isCollapsed && 'flex justify-center')}>
				<ThemeToggle variant={isCollapsed ? 'icon' : 'segmented'} class={isCollapsed ? undefined : 'w-full'} />
			</div>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger
					class={cn(
						'flex w-full items-center rounded-xl py-2 text-sm font-medium transition-all duration-200 hover:bg-accent',
						isCollapsed ? 'justify-center px-2' : 'gap-3 px-3'
					)}
				>
					<Avatar.Root class="h-9 w-9 ring-2 ring-primary/20">
						<Avatar.Image src={user.image ?? undefined} alt={user.name ?? 'User'} />
						<Avatar.Fallback class="bg-primary text-sm font-semibold text-primary-foreground">
							{userInitials}
						</Avatar.Fallback>
					</Avatar.Root>
					{#if !isCollapsed}
						<div class="min-w-0 flex-1 overflow-hidden text-left">
							<p class="truncate text-sm font-medium">{user.name ?? 'User'}</p>
							<p class="truncate text-xs text-muted-foreground">{user.email}</p>
						</div>
					{/if}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					<DropdownMenu.Label class="font-semibold">My Account</DropdownMenu.Label>
					<DropdownMenu.Separator />
					<DropdownMenu.Item>
						<form method="POST" action="/auth/signout?/signOut" class="w-full">
							<button type="submit" class="flex w-full items-center gap-2.5 text-destructive">
								<LogOut class="h-4 w-4" />
								Sign out
							</button>
						</form>
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</aside>
{:else if !isPublicChromeless}
	<header
		class="fixed top-0 right-0 left-0 z-50 h-12 border-b border-border/80 bg-card pt-safe lg:h-14"
	>
		<div
			class="flex h-12 items-center justify-between px-3 lg:mx-auto lg:h-14 lg:max-w-7xl lg:px-6"
		>
			<a href="/"><Logo size="md" showIcon={true} compactIcon={true} /></a>
			<div class="flex items-center gap-2">
				<ThemeToggle />
				<Button href="/signin" size="sm" class="touch-target lg:h-8">Login</Button>
			</div>
		</div>
	</header>
{/if}

<div
	class={cn(
		'min-h-screen min-w-0 transition-[margin,padding] duration-300',
		user && !isPublicChromeless && 'app-shell',
		isPublicChromeless
			? 'pt-0'
			: user
				? 'pt-mobile-top pb-mobile-tab lg:pt-4 lg:pb-0'
				: 'pt-12 lg:pt-14',
		user && !isCollapsed ? 'lg:ml-[19rem]' : user && isCollapsed ? 'lg:ml-[7.5rem]' : 'lg:ml-0',
		user && !isPublicChromeless && 'lg:pr-4'
	)}
>
	{@render children()}
</div>
