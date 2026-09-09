<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { cn } from '$lib/utils';
	import Logo from '$lib/components/Logo.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Avatar from '$lib/components/ui/avatar';
	import { SHOW_TRANSACTIONS_UI } from '$lib/feature-flags';
	import {
		Home,
		FileText,
		Users,
		Menu,
		X,
		ChevronLeft,
		ChevronRight,
		ArrowLeftRight,
		Landmark,
		LogOut,
		Settings,
		HandCoins
	} from 'lucide-svelte';
	interface NavItem {
		title: string;
		href: string;
		icon: typeof Home;
	}

	interface UserInfo {
		name?: string | null;
		email?: string | null;
		image?: string | null;
	}

	interface Props {
		user?: UserInfo | null;
		children: Snippet;
	}

	let { user = null, children }: Props = $props();

	let isCollapsed = $state(false);
	let isMobileMenuOpen = $state(false);

	const navItems = [
		{ title: 'Dashboard', href: '/dashboard', icon: Home },
		{ title: 'Loans', href: '/loans', icon: FileText },
		...(SHOW_TRANSACTIONS_UI
			? [{ title: 'Transactions', href: '/transactions', icon: ArrowLeftRight }]
			: []),
		{ title: 'Borrowings', href: '/debts', icon: HandCoins },
		{ title: 'Investors', href: '/investors', icon: Users },
		{ title: 'Settings', href: '/settings', icon: Settings }
	] satisfies NavItem[];

	const pathname = $derived(page.url.pathname);
	const isLandingPage = $derived(!user && pathname === '/');
	const isSignInPage = $derived(!user && pathname === '/signin');
	const isPublicChromeless = $derived(isLandingPage || isSignInPage);

	const userInitials = $derived(
		user?.name
			? user.name
					.split(' ')
					.map((n) => n[0])
					.join('')
					.toUpperCase()
			: (user?.email?.[0]?.toUpperCase() ?? 'U')
	);

	function isActive(href: string) {
		return pathname === href || (href !== '/' && pathname.startsWith(href + '/'));
	}

	$effect(() => {
		if (isMobileMenuOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = 'unset';
		}
	});

	$effect(() => {
		void pathname;
		isMobileMenuOpen = false;
	});
</script>

{#if !isPublicChromeless}
	<header class="fixed top-0 right-0 left-0 z-50 h-12 border-b border-border/80 bg-card lg:hidden">
		<div class="flex h-full items-center justify-between px-3">
			<a href={user ? '/dashboard' : '/'} class="flex items-center space-x-2">
				<Logo size="md" showIcon={true} />
			</a>
			<div class="flex items-center gap-2">
				{#if !user}
					<Button href="/signin" size="sm">Login</Button>
				{:else}
					<button
						type="button"
						class="rounded-md p-2 transition-colors hover:bg-accent"
						aria-label="Toggle menu"
						onclick={() => (isMobileMenuOpen = !isMobileMenuOpen)}
					>
						{#if isMobileMenuOpen}<X class="h-5 w-5" />{:else}<Menu class="h-5 w-5" />{/if}
					</button>
				{/if}
			</div>
		</div>
	</header>
{/if}

{#if user && isMobileMenuOpen}
	<div
		class="fixed inset-0 top-12 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
		role="button"
		tabindex="0"
		onclick={() => (isMobileMenuOpen = false)}
		onkeydown={() => {}}
	></div>
{/if}

{#if user}
	<aside
		class={cn(
			'fixed right-0 bottom-0 left-0 z-40 flex flex-col border-t border-border/80 bg-card transition-all duration-200 lg:hidden',
			isMobileMenuOpen ? 'top-12 translate-x-0 opacity-100' : 'top-12 translate-x-full opacity-0'
		)}
	>
		<nav class="flex-1 space-y-0.5 overflow-y-auto p-2">
			{#each navItems as item}
				<a
					href={item.href}
					data-sveltekit-preload-data="hover"
					data-sveltekit-preload-code="hover"
					class={cn(
						'flex items-center space-x-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
						isActive(item.href)
							? 'nav-item-active'
							: 'text-muted-foreground hover:bg-accent hover:text-foreground'
					)}
				>
					<div
						class={cn(
							'flex h-7 w-7 items-center justify-center rounded-md',
							isActive(item.href) ? 'nav-item-active-icon' : 'bg-muted'
						)}
					>
						<item.icon class="h-3.5 w-3.5" />
					</div>
					<span>{item.title}</span>
				</a>
			{/each}
		</nav>
		<div class="mt-auto border-t border-border/80">
			<form method="POST" action="/auth/signout">
				<button
					type="submit"
					class="flex w-full items-center justify-center space-x-2 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/5"
				>
					<LogOut class="h-4 w-4" />
					<span>Sign Out</span>
				</button>
			</form>
		</div>
	</aside>

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
				<a href="/dashboard"><Logo size="md" showIcon={true} /></a>
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
			{#each navItems as item}
				<a
					href={item.href}
					data-sveltekit-preload-data="hover"
					data-sveltekit-preload-code="hover"
					title={isCollapsed ? item.title : undefined}
					class={cn(
						'group relative flex items-center rounded-md py-2 text-sm font-medium transition-colors',
						isActive(item.href)
							? 'nav-item-active'
							: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
						isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
					)}
				>
					<div
						class={cn(
							'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
							isActive(item.href) ? 'nav-item-active-icon' : 'bg-muted/80 group-hover:bg-primary/10'
						)}
					>
						<item.icon class="h-3.5 w-3.5" />
					</div>
					{#if !isCollapsed}<span class="truncate">{item.title}</span>{/if}
				</a>
			{/each}
		</nav>
		{#if user}
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
		{/if}
	</aside>
{:else if !isPublicChromeless}
	<header
		class="fixed top-0 right-0 left-0 z-50 hidden h-14 border-b bg-card/80 backdrop-blur-xl lg:block"
	>
		<div class="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
			<a href="/"><Logo size="md" showIcon={true} /></a>
			<Button href="/signin">Login</Button>
		</div>
	</header>
{/if}

<div
	class={cn(
		'min-h-screen transition-[margin] duration-200',
		isPublicChromeless ? 'pt-0' : 'pt-12',
		user && !isCollapsed
			? 'lg:ml-56 lg:pt-0'
			: user && isCollapsed
				? 'lg:ml-[4.25rem] lg:pt-0'
				: isPublicChromeless
					? 'lg:ml-0 lg:pt-0'
					: 'lg:ml-0 lg:pt-14'
	)}
>
	{@render children()}
</div>
