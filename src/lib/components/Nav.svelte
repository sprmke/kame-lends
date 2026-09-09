<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { cn } from '$lib/utils';
	import Logo from '$lib/components/Logo.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Avatar from '$lib/components/ui/avatar';
	import MobileTabBar from '$lib/components/layout/MobileTabBar.svelte';
	import MobileTopBar from '$lib/components/layout/MobileTopBar.svelte';
	import MobileMoreSheet from '$lib/components/layout/MobileMoreSheet.svelte';
	import {
		buildAppNav,
		DEFAULT_NAV_CAPABILITIES,
		isDetailRoute,
		isNavActive,
		resolveMobilePageTitle,
		type NavCapabilities
	} from '$lib/nav/app-nav';
	import { mobilePageTitle } from '$lib/stores/mobile-page-title.svelte';
	import { ChevronLeft, ChevronRight, Landmark, LogOut } from 'lucide-svelte';

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

	const mobileTitle = $derived(mobilePageTitle.override ?? resolveMobilePageTitle(pathname));
	const showMobileBack = $derived(isDetailRoute(pathname));
	const showMobileLogo = $derived(pathname === '/dashboard' || pathname === '/');

	const moreActive = $derived(
		moreOpen || nav.moreNavItems.some((item) => isNavActive(pathname, item.href))
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

{#if user && !isPublicChromeless}
	<MobileTopBar
		title={mobileTitle}
		showBack={showMobileBack}
		showLogo={showMobileLogo && !showMobileBack}
		backHref=".."
	/>

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
			'fixed top-0 left-0 z-40 hidden h-screen flex-col border-r border-border/80 bg-card transition-all duration-200 lg:flex',
			isCollapsed ? 'w-[4.25rem]' : 'w-56'
		)}
	>
		<div
			class={cn(
				'flex h-12 shrink-0 items-center border-b border-border/80',
				isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
			)}
		>
			{#if !isCollapsed}
				<a href="/dashboard"><Logo size="md" showIcon={true} compactIcon={true} /></a>
			{:else}
				<a href="/dashboard" class="flex justify-center" title="Dashboard">
					<span
						class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
					>
						<Landmark class="h-3.5 w-3.5" />
					</span>
				</a>
			{/if}
			<button
				type="button"
				class={cn(
					'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
					isCollapsed && 'absolute top-3 -right-3 border border-border/80 bg-card shadow-sm'
				)}
				aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				onclick={() => (isCollapsed = !isCollapsed)}
			>
				{#if isCollapsed}<ChevronRight class="h-3.5 w-3.5" />{:else}<ChevronLeft
						class="h-3.5 w-3.5"
					/>{/if}
			</button>
		</div>
		<nav class={cn('flex-1 space-y-0.5 overflow-y-auto py-2', isCollapsed ? 'px-1.5' : 'px-2')}>
			{#each nav.sidebarItems as item (item.id)}
				<a
					href={item.href}
					data-sveltekit-preload-data="hover"
					data-sveltekit-preload-code="hover"
					title={isCollapsed ? item.title : undefined}
					class={cn(
						'group relative flex items-center rounded-md py-2 text-sm font-medium transition-colors',
						isNavActive(pathname, item.href)
							? 'nav-item-active'
							: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
						isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
					)}
				>
					<div
						class={cn(
							'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
							isNavActive(pathname, item.href)
								? 'nav-item-active-icon'
								: 'bg-muted/80 group-hover:bg-primary/10'
						)}
					>
						<item.icon class="h-3.5 w-3.5" />
					</div>
					{#if !isCollapsed}<span class="truncate">{item.title}</span>{/if}
				</a>
			{/each}
		</nav>
		<div class="border-t border-border/80 p-2">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger
					class={cn(
						'flex w-full items-center rounded-md py-1.5 text-sm font-medium transition-colors hover:bg-accent',
						isCollapsed ? 'justify-center px-1' : 'gap-2.5 px-2'
					)}
				>
					<Avatar.Root class="h-8 w-8 ring-1 ring-border">
						<Avatar.Image src={user.image ?? undefined} alt={user.name ?? 'User'} />
						<Avatar.Fallback class="bg-primary text-xs font-semibold text-primary-foreground">
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
				<DropdownMenu.Content align="end" class="w-56">
					<DropdownMenu.Label>My Account</DropdownMenu.Label>
					<DropdownMenu.Separator />
					<DropdownMenu.Item>
						<form method="POST" action="/auth/signout" class="w-full">
							<button type="submit" class="flex w-full items-center text-destructive">
								<LogOut class="mr-2 h-4 w-4" />
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
			<Button href="/signin" size="sm" class="touch-target lg:h-8">Login</Button>
		</div>
	</header>
{/if}

<div
	class={cn(
		'min-h-screen transition-[margin,padding] duration-200',
		isPublicChromeless
			? 'pt-0'
			: user
				? 'pt-mobile-top pb-mobile-tab lg:pt-0 lg:pb-0'
				: 'pt-12 lg:pt-14',
		user && !isCollapsed ? 'lg:ml-56' : user && isCollapsed ? 'lg:ml-[4.25rem]' : 'lg:ml-0'
	)}
>
	{@render children()}
</div>
