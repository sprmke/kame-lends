<script lang="ts">
	import type { AssistantConversationDto } from '$lib/assistant/types';
	import { Check, MessageSquare, Pencil, Plus, Search, Trash2, X } from 'lucide-svelte';

	interface Props {
		conversations: AssistantConversationDto[];
		activeId: string | null;
		loading: boolean;
		onOpen: (id: string) => void;
		onNew: () => void;
		onDelete: (id: string) => void;
		onRename: (id: string, title: string) => void;
		onClearAll: () => void;
	}

	let {
		conversations,
		activeId,
		loading,
		onOpen,
		onNew,
		onDelete,
		onRename,
		onClearAll
	}: Props = $props();
	let query = $state('');
	let editingId = $state<string | null>(null);
	let editingTitle = $state('');

	const filtered = $derived(
		conversations.filter((conversation) =>
			conversation.title.toLowerCase().includes(query.trim().toLowerCase())
		)
	);

	const groups = $derived.by(() => {
		const today = new Date();
		const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
		const buckets: Array<{ label: string; items: AssistantConversationDto[] }> = [
			{ label: 'Today', items: [] },
			{ label: 'Yesterday', items: [] },
			{ label: 'Earlier', items: [] }
		];
		for (const conversation of filtered) {
			const time = new Date(conversation.updatedAt).getTime();
			if (time >= startOfDay) buckets[0].items.push(conversation);
			else if (time >= startOfDay - 86_400_000) buckets[1].items.push(conversation);
			else buckets[2].items.push(conversation);
		}
		return buckets.filter((bucket) => bucket.items.length > 0);
	});

	function beginRename(conversation: AssistantConversationDto) {
		editingId = conversation.id;
		editingTitle = conversation.title;
	}

	function commitRename() {
		if (editingId && editingTitle.trim()) onRename(editingId, editingTitle.trim());
		editingId = null;
	}

	function confirmClear() {
		if (conversations.length === 0) return;
		if (window.confirm('Delete all assistant conversations? This cannot be undone.')) {
			onClearAll();
		}
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center gap-1.5 border-b border-border/60 px-3 py-2.5">
		<p class="min-w-0 flex-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">History</p>
		<button
			type="button"
			class="native-press inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
			aria-label="New chat"
			onclick={onNew}
		>
			<Plus class="size-4" />
		</button>
	</div>
	<div class="border-b border-border/50 px-2.5 py-2">
		<div class="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2 py-1">
			<Search class="size-3 text-muted-foreground" />
			<input
				bind:value={query}
				placeholder="Search"
				class="min-w-0 flex-1 bg-transparent text-[11.5px] outline-none placeholder:text-muted-foreground/60"
				aria-label="Search conversations"
			/>
		</div>
	</div>
	<div class="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
		{#if loading}
			<div class="space-y-1.5 p-1">
				{#each [0, 1, 2] as index (index)}
					<div class="h-8 animate-pulse rounded-md bg-muted/60"></div>
				{/each}
			</div>
		{:else if filtered.length === 0}
			<p class="px-2 py-4 text-[11px] text-muted-foreground">
				{conversations.length === 0 ? 'No conversations yet.' : 'No match.'}
			</p>
		{:else}
			{#each groups as group}
				<p class="px-2 pt-2 pb-1 text-[9.5px] font-semibold tracking-wide text-muted-foreground uppercase">
					{group.label}
				</p>
				{#each group.items as conversation (conversation.id)}
					<div
						class={[
							'group flex items-center gap-1 rounded-lg px-1 transition-colors',
							conversation.id === activeId ? 'bg-primary/10' : 'hover:bg-muted/60'
						]}
					>
						{#if editingId === conversation.id}
							<div class="flex flex-1 items-center gap-1 py-0.5">
								<input
									bind:value={editingTitle}
									class="min-w-0 flex-1 rounded border border-border/70 bg-background px-1.5 py-1 text-[11.5px] outline-none"
									onkeydown={(event) => {
										if (event.key === 'Enter') commitRename();
										if (event.key === 'Escape') editingId = null;
									}}
								/>
								<button
									type="button"
									class="inline-flex size-6 items-center justify-center rounded text-primary hover:bg-primary/10"
									aria-label="Save title"
									onclick={commitRename}
								>
									<Check class="size-3" />
								</button>
							</div>
						{:else}
							<button
								type="button"
								class="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1.5 text-left text-[11.5px]"
								onclick={() => onOpen(conversation.id)}
							>
								<MessageSquare class="size-3 shrink-0 text-muted-foreground" />
								<span class="truncate">{conversation.title}</span>
							</button>
							<button
								type="button"
								class="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 focus:opacity-100"
								aria-label={`Rename ${conversation.title}`}
								onclick={() => beginRename(conversation)}
							>
								<Pencil class="size-2.5" />
							</button>
							<button
								type="button"
								class="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
								aria-label={`Delete ${conversation.title}`}
								onclick={() => onDelete(conversation.id)}
							>
								<Trash2 class="size-2.5" />
							</button>
						{/if}
					</div>
				{/each}
			{/each}
		{/if}
	</div>
	{#if conversations.length > 0}
		<div class="border-t border-border/60 px-2.5 py-2">
			<button
				type="button"
				class="inline-flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground hover:text-destructive"
				onclick={confirmClear}
			>
				<X class="size-3" /> Clear all
			</button>
		</div>
	{/if}
</div>
