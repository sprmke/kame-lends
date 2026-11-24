<script lang="ts">
	import './layout.css';
	import '$lib/styles/accessibility.css';
	import { ModeWatcher } from 'mode-watcher';
	import { APP_DESCRIPTION, APP_NAME } from '$lib/brand';
	import Nav from '$lib/components/Nav.svelte';
	import PriceVisibilityShell from '$lib/components/common/PriceVisibilityShell.svelte';
	import DashboardSkeleton from '$lib/components/common/DashboardSkeleton.svelte';
	import ListPageSkeleton, {
		type ListPageSkeletonVariant
	} from '$lib/components/common/ListPageSkeleton.svelte';
	import DetailPageSkeleton, {
		type DetailPageSkeletonVariant
	} from '$lib/components/common/DetailPageSkeleton.svelte';
	import NavigationProgress from '$lib/components/common/NavigationProgress.svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import PwaProvider from '$lib/components/pwa/PwaProvider.svelte';
	import AssistantLauncher from '$lib/components/assistant/AssistantLauncher.svelte';
	import { SHOW_GROUPS_UI } from '$lib/feature-flags';
	import { navigating, page } from '$app/state';
	import { releaseStaleBodyScrollLock } from '$lib/composables/body-scroll-lock-release';
	import { createDelayedFlag } from '$lib/composables/use-delayed-flag.svelte';
	import { overlayStackIsOpen } from '$lib/composables/overlay-stack.svelte';
	import { tick } from 'svelte';
	import {
		THEME_COLOR_DARK,
		THEME_COLOR_DASHBOARD,
		THEME_COLOR_LIGHT,
		THEME_STORAGE_KEY
	} from '$lib/theme/preferences';

	let { data, children } = $props();

	$effect(() => {
		const root = document.documentElement;
		if (data.session?.user) {
			root.classList.add('dashboard-shell');
		} else {
			root.classList.remove('dashboard-shell');
		}
		return () => root.classList.remove('dashboard-shell');
	});

	$effect(() => {
		const root = document.documentElement;
		const overlaysOpen = overlayStackIsOpen();
		root.classList.toggle('overlay-open', overlaysOpen);
		if (overlaysOpen) return;
		// After bits-ui close animation + scroll-lock cleanup (24ms), fix orphaned body locks.
		void tick().then(() => {
			window.setTimeout(() => releaseStaleBodyScrollLock(), 32);
		});
	});

	const listRoutes = new Set([
		'/loans',
		'/investments',
		'/borrowed',
		'/commissioned',
		'/witnessed',
		'/groups',
		'/investors',
		'/borrowers',
		'/witnesses',
		'/debts',
		'/transactions'
	]);

	const partyFormRoutes = new Set(['/investors/new', '/borrowers/new', '/witnesses/new']);

	function resolveDetailSkeleton(path: string): DetailPageSkeletonVariant | null {
		if (path === '/loans/new') return 'loan-form';
		if (path === '/debts/new') return 'debt-form';
		if (path === '/transactions/new') return 'transaction-form';
		if (partyFormRoutes.has(path)) return 'party-form';
		if (path === '/settings') return 'settings';
		if (/^\/debts\/[^/]+$/.test(path)) return 'debt';
		if (/^\/loans\/[^/]+\/sign$/.test(path)) return 'signing';
		if (/^\/loans\/[^/]+$/.test(path)) return 'loan';
		if (/^\/groups\/[^/]+$/.test(path)) return 'group';
		if (/^\/investors\/[^/]+$/.test(path)) return 'investor';
		if (/^\/transactions\/[^/]+$/.test(path)) return 'transaction';
		if (/^\/borrowers\/[^/]+$/.test(path)) return 'borrower';
		if (/^\/witnesses\/[^/]+$/.test(path)) return 'witness';
		return null;
	}

	const routeSkeletonPending = $derived(
		navigating.to?.url.pathname != null &&
			navigating.from?.url.pathname !== navigating.to.url.pathname
	);

	const delayedRouteSkeleton = createDelayedFlag(() => routeSkeletonPending, 120);

	const showRouteSkeleton = $derived(delayedRouteSkeleton.active);

	const destinationPath = $derived(navigating.to?.url.pathname ?? '');

	const showDashboardSkeleton = $derived(
		showRouteSkeleton && destinationPath === '/dashboard'
	);

	const detailSkeletonVariant = $derived(resolveDetailSkeleton(destinationPath));

	const showDetailSkeleton = $derived(showRouteSkeleton && detailSkeletonVariant != null);

	const listSkeletonVariant = $derived.by((): ListPageSkeletonVariant => {
		if (destinationPath === '/investors') return 'investors';
		if (destinationPath === '/borrowers') return 'borrowers';
		if (destinationPath === '/witnesses') return 'witnesses';
		if (destinationPath === '/debts') return 'debts';
		if (destinationPath === '/transactions') return 'transactions';
		if (destinationPath === '/groups') return 'groups';
		if (destinationPath === '/investments') return 'investments';
		if (destinationPath === '/borrowed') return 'borrowed';
		if (destinationPath === '/commissioned') return 'commissioned';
		if (destinationPath === '/witnessed') return 'witnessed';
		return 'loans';
	});

	const showListSkeleton = $derived(
		showRouteSkeleton &&
			!showDashboardSkeleton &&
			!showDetailSkeleton &&
			listRoutes.has(destinationPath)
	);

	const themeColors = $derived(
		data.session?.user
			? { light: THEME_COLOR_DASHBOARD, dark: THEME_COLOR_DASHBOARD }
			: { light: THEME_COLOR_LIGHT, dark: THEME_COLOR_DARK }
	);

	const hasGroupsColumn = $derived(
		SHOW_GROUPS_UI &&
			(((data as { groupsIndex?: unknown[] }).groupsIndex?.length ?? 0) > 0)
	);
</script>

<ModeWatcher
	defaultMode="system"
	modeStorageKey={THEME_STORAGE_KEY}
	themeColors={themeColors}
/>

<!-- Icons live in app.html; social cards need an absolute image URL per deploy origin. -->
<svelte:head>
	<meta name="description" content={APP_DESCRIPTION} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={APP_NAME} />
	<meta property="og:title" content={APP_NAME} />
	<meta property="og:description" content={APP_DESCRIPTION} />
	<meta property="og:image" content="{page.url.origin}/og-image.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="{APP_NAME} logo" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={APP_NAME} />
	<meta name="twitter:description" content={APP_DESCRIPTION} />
	<meta name="twitter:image" content="{page.url.origin}/og-image.png" />
</svelte:head>

<NavigationProgress />

<PwaProvider userId={data.session?.user?.id ?? null}>
	<Nav user={data.session?.user} navCapabilities={data.navCapabilities}>
		<PriceVisibilityShell>
			{#if showDashboardSkeleton}
				<div class="dashboard-page">
					<DashboardSkeleton showGroupsColumn={hasGroupsColumn} />
				</div>
			{:else if showDetailSkeleton && detailSkeletonVariant}
				<DetailPageSkeleton variant={detailSkeletonVariant} />
			{:else if showListSkeleton}
				<ListPageSkeleton
					variant={listSkeletonVariant}
					showScopeTabs={destinationPath === '/loans'}
				/>
			{:else}
				{@render children()}
			{/if}
		</PriceVisibilityShell>
	</Nav>
	{#if data.session?.user}
		<AssistantLauncher />
	{/if}
</PwaProvider>
<Toaster />
