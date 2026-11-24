<script lang="ts">
	import { onDestroy } from 'svelte';
	import { AssistantStore } from '$lib/assistant/store.svelte';
	import { useAiStatus } from '$lib/ai-status.svelte';
	import { page } from '$app/state';
	import Thread from './Thread.svelte';
	import Composer from './Composer.svelte';
	import HistoryList from './HistoryList.svelte';
	import { Button } from '$lib/components/ui/button';
	import { ArrowUpRight, History, Plus, Sparkles, X } from 'lucide-svelte';

	interface Props {
		variant?: 'panel' | 'page';
		initialConversationId?: string | null;
		onClose?: () => void;
	}

	let { variant = 'panel', initialConversationId = null, onClose }: Props = $props();

	const store = new AssistantStore();
	const ai = useAiStatus();
	let historyOpen = $state(false);
	const RESTORE_KEY = 'kl-assistant:last';
	onDestroy(() => store.stop());
	const restoredConversationId =
		variant === 'panel' && typeof sessionStorage !== 'undefined'
			? sessionStorage.getItem(RESTORE_KEY)
			: null;

	const currentPath = $derived(page.url.pathname);
	const isAssistantRoute = $derived(currentPath.startsWith('/assistant'));
	const pagePath = $derived(isAssistantRoute ? null : currentPath);
	const isOwner = $derived(
		Boolean((page.data as { navCapabilities?: { isAdminWorkspace?: boolean } }).navCapabilities?.isAdminWorkspace)
	);

	const pageLabel = $derived.by(() => {
		const path = pagePath ?? '';
		const loan = /^\/loans\/(\d+)/.exec(path);
		if (loan) return `Viewing Loan #${loan[1]}`;
		const borrower = /^\/borrowers\/(\d+)/.exec(path);
		if (borrower) return 'Viewing a borrower';
		const investor = /^\/investors\/(\d+)/.exec(path);
		if (investor) return 'Viewing an investor';
		const debt = /^\/debts\/(\d+)/.exec(path);
		if (debt) return 'Viewing a bank loan';
		const group = /^\/groups\/(\d+)/.exec(path);
		if (group) return 'Viewing a group';
		if (path === '/loans') return 'Viewing loans';
		if (path === '/dashboard') return 'Viewing the dashboard';
		return null;
	});

	$effect(() => {
		void store.init({
			page: pagePath,
			conversationId: initialConversationId ?? restoredConversationId
		});
	});

	$effect(() => {
		if (variant !== 'panel') return;
		if (store.conversationId) sessionStorage.setItem(RESTORE_KEY, store.conversationId);
	});

	function send(text: string, image?: string) {
		void store.send(text, image);
	}

	function openConversation(id: string) {
		historyOpen = false;
		void store.loadConversation(id);
		if (variant === 'page') {
			history.replaceState({}, '', `/assistant/${id}`);
		}
	}

	function newChat() {
		store.newConversation();
		if (variant === 'panel') sessionStorage.removeItem(RESTORE_KEY);
		historyOpen = false;
		if (variant === 'page') {
			history.replaceState({}, '', '/assistant');
		}
	}
</script>

<div class={['relative flex h-full min-h-0 flex-col bg-background', variant === 'page' ? 'h-[calc(100dvh-9rem)] lg:h-[calc(100dvh-3rem)]' : '']}>
	<header class="flex shrink-0 items-center gap-1.5 border-b border-border/60 px-2.5 py-2">
		{#if variant === 'panel' || variant === 'page'}
			<button
				type="button"
				class={[
					'native-press inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground',
					variant === 'page' ? 'lg:hidden' : ''
				]}
				aria-label="Conversation history"
				onclick={() => (historyOpen = !historyOpen)}
			>
				<History class="size-4" />
			</button>
		{/if}
		<div class="flex min-w-0 flex-1 items-center gap-1.5">
			<div class="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
				<Sparkles class="size-3" />
			</div>
			<div class="min-w-0">
				<p class="truncate text-[12.5px] font-semibold leading-tight">Ask Kame</p>
				<p class="truncate text-[9.5px] leading-tight text-muted-foreground">Read-only answers</p>
			</div>
		</div>
		<button
			type="button"
			class="native-press inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
			aria-label="New chat"
			onclick={newChat}
		>
			<Plus class="size-4" />
		</button>
		{#if variant === 'panel'}
			<Button
				variant="ghost"
				size="icon"
				class="size-8 rounded-lg"
				href={store.conversationId ? `/assistant/${store.conversationId}` : '/assistant'}
				aria-label="Open the full assistant"
			>
				<ArrowUpRight class="size-4" />
			</Button>
			<button
				type="button"
				class="native-press inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
				aria-label="Close assistant"
				onclick={onClose}
			>
				<X class="size-4" />
			</button>
		{/if}
	</header>

	{#if !ai.loaded}
		<div class="flex flex-1 items-center justify-center">
			<div class="size-6 animate-spin rounded-full border-2 border-muted border-t-primary"></div>
		</div>
	{:else if !ai.assistantChat}
		<div class="flex flex-1 flex-col items-center justify-center px-6 text-center">
			<div class="flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
				<Sparkles class="size-5" />
			</div>
			<p class="mt-3 text-[13px] font-semibold">Assistant unavailable</p>
			<p class="mt-1 max-w-[15rem] text-[11.5px] leading-snug text-muted-foreground">
				Ask Kame is turned off for this account right now.
			</p>
		</div>
	{:else}
		<div class="flex min-h-0 flex-1">
			{#if variant === 'page'}
				<aside class="hidden w-[16rem] shrink-0 border-r border-border/60 lg:block">
					<HistoryList
						conversations={store.conversations}
						activeId={store.conversationId}
						loading={store.loadingHistory}
						onOpen={openConversation}
						onNew={newChat}
						onDelete={(id) => void store.deleteConversation(id)}
						onRename={(id, title) => void store.renameConversation(id, title)}
						onClearAll={() => void store.clearAll()}
					/>
				</aside>
			{/if}
			{#if historyOpen}
				<div
					class={[
						'absolute inset-0 z-20 flex flex-col bg-background',
						variant === 'page' ? 'lg:hidden' : ''
					]}
				>
					<HistoryList
						conversations={store.conversations}
						activeId={store.conversationId}
						loading={store.loadingHistory}
						onOpen={openConversation}
						onNew={newChat}
						onDelete={(id) => void store.deleteConversation(id)}
						onRename={(id, title) => void store.renameConversation(id, title)}
						onClearAll={() => void store.clearAll()}
					/>
				</div>
			{/if}
			<div class="flex min-h-0 min-w-0 flex-1 flex-col">
				<Thread
					messages={store.messages}
					steps={store.steps}
					phase={store.phase}
					streaming={store.streaming}
					loading={store.loading}
					error={store.error}
					page={pagePath}
					{isOwner}
					onAsk={send}
					onFeedback={(id, value) => void store.feedback(id, value)}
					onRegenerate={() => void store.regenerate()}
				/>
				<Composer
					streaming={store.streaming}
					pins={store.pins}
					pageLabel={pageLabel}
					onSend={send}
					onStop={() => store.stop()}
					onAddPin={(pin) => store.addPin(pin)}
					onRemovePin={(pin) => store.removePin(pin)}
				/>
			</div>
		</div>
	{/if}
</div>
