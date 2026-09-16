<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { toast } from '$lib/toast';
	import { MessageCircle } from 'lucide-svelte';
	import {
		GROUP_TELEGRAM_PLACEHOLDERS,
		GROUP_TELEGRAM_TEMPLATE_KINDS,
		GROUP_TELEGRAM_TEMPLATE_LABELS,
		type GroupTelegramTemplateKind
	} from '$lib/groups/group-telegram-templates';

	type TelegramSettings = {
		status?: string;
		enabled?: boolean;
		notifyUpcoming?: boolean;
		reminderDays?: number[];
		notifyDueToday?: boolean;
		notifyOverdue?: boolean;
		notifyDailyDigest?: boolean;
		notifyActivity?: boolean;
		includeAmounts?: boolean;
		chatTitle?: string | null;
		lastSentAt?: string | Date | null;
		lastError?: string | null;
		botTokenConfigured?: boolean;
		templates?: Partial<Record<GroupTelegramTemplateKind, string>>;
	};

	interface Props {
		groupId: number;
		startGroupAvailable?: boolean;
		initial?: TelegramSettings | null;
		onChanged?: () => void | Promise<void>;
	}

	let { groupId, startGroupAvailable = false, initial = null, onChanged }: Props = $props();

	const editableTemplateKinds = GROUP_TELEGRAM_TEMPLATE_KINDS.filter(
		(kind) => kind !== 'test'
	);

	let settings = $state<TelegramSettings>({ ...(initial ?? {}) });
	let busy = $state(false);
	let pollTimer: ReturnType<typeof setInterval> | undefined;
	let botTokenInput = $state('');
	let chatIdInput = $state('');
	let templateDrafts = $state<Partial<Record<GroupTelegramTemplateKind, string>>>({});

	$effect(() => {
		settings = { ...(initial ?? {}) };
		if (initial?.templates) {
			templateDrafts = { ...initial.templates };
		}
	});
	$effect(() => {
		return () => {
			if (pollTimer) clearInterval(pollTimer);
		};
	});

	const status = $derived(settings.status ?? 'disconnected');
	const connected = $derived(status === 'connected');

	function placeholdersFor(kind: GroupTelegramTemplateKind): string {
		return GROUP_TELEGRAM_PLACEHOLDERS
			.filter((row) => row.kinds.includes(kind))
			.map((row) => `{{${row.key}}}`)
			.join(', ');
	}

	async function refreshSettings() {
		const res = await fetch(`/api/groups/${groupId}/telegram`);
		if (!res.ok) return;
		const body = (await res.json()) as {
			settings?: TelegramSettings;
			startGroupAvailable?: boolean;
		};
		if (body.settings) {
			settings = body.settings;
			if (body.settings.templates) {
				templateDrafts = { ...body.settings.templates };
			}
		}
	}

	async function connectManual() {
		const chatId = chatIdInput.trim();
		if (!chatId) {
			toast.error('Chat ID required');
			return;
		}
		busy = true;
		try {
			const payload: { chatId: string; botToken?: string } = { chatId };
			const token = botTokenInput.trim();
			if (token) payload.botToken = token;

			const res = await fetch(`/api/groups/${groupId}/telegram/connect`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error((body as { error?: string }).error ?? 'Connect failed');
			}
			const body = (await res.json()) as { settings?: TelegramSettings };
			if (body.settings) {
				settings = body.settings;
				if (body.settings.templates) {
					templateDrafts = { ...body.settings.templates };
				}
			}
			botTokenInput = '';
			chatIdInput = '';
			toast.success('Telegram connected');
			await onChanged?.();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Connect failed');
		} finally {
			busy = false;
		}
	}

	async function connectViaLink() {
		busy = true;
		try {
			const res = await fetch(`/api/groups/${groupId}/telegram/link`, { method: 'POST' });
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error((body as { error?: string }).error ?? 'Could not create link');
			}
			const body = (await res.json()) as { url: string };
			window.open(body.url, '_blank', 'noopener,noreferrer');
			toast.success('Open Telegram and pick a group');
			if (pollTimer) clearInterval(pollTimer);
			const started = Date.now();
			pollTimer = setInterval(async () => {
				await refreshSettings();
				if (settings.status === 'connected') {
					if (pollTimer) clearInterval(pollTimer);
					toast.success('Telegram connected');
					await onChanged?.();
				} else if (Date.now() - started > 120_000) {
					if (pollTimer) clearInterval(pollTimer);
				}
			}, 3000);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Connect failed');
		} finally {
			busy = false;
		}
	}

	async function savePatch(patch: Record<string, unknown>) {
		busy = true;
		try {
			const res = await fetch(`/api/groups/${groupId}/telegram`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(patch)
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error((body as { error?: string }).error ?? 'Save failed');
			}
			settings = { ...settings, ...(await res.json()) };
			toast.success('Saved');
			await onChanged?.();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Save failed');
		} finally {
			busy = false;
		}
	}

	async function saveTemplates() {
		const templates: Record<string, string> = {};
		for (const kind of editableTemplateKinds) {
			const value = templateDrafts[kind]?.trim();
			if (value) templates[kind] = value;
		}
		await savePatch({ templates });
	}

	async function sendTest() {
		busy = true;
		try {
			const res = await fetch(`/api/groups/${groupId}/telegram/test`, { method: 'POST' });
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error((body as { error?: string }).error ?? 'Test failed');
			}
			toast.success('Test message sent');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Test failed');
		} finally {
			busy = false;
		}
	}

	async function disconnect() {
		busy = true;
		try {
			const res = await fetch(`/api/groups/${groupId}/telegram`, { method: 'DELETE' });
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error((body as { error?: string }).error ?? 'Disconnect failed');
			}
			settings = { ...settings, status: 'disconnected', chatTitle: null };
			toast.success('Disconnected');
			await onChanged?.();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Disconnect failed');
		} finally {
			busy = false;
		}
	}

	function toggleReminderDay(day: number, on: boolean) {
		const current = [...(settings.reminderDays ?? [3, 1])];
		const next = on
			? [...new Set([...current, day])].sort((a, b) => b - a)
			: current.filter((value) => value !== day);
		settings = { ...settings, reminderDays: next };
		void savePatch({ reminderDays: next });
	}
</script>

<Card.Root>
	<Card.Header class="flex flex-row items-center gap-2">
		<MessageCircle class="size-4 text-muted-foreground" aria-hidden="true" />
		<Card.Title class="text-base">Telegram</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4">
		{#if status === 'bot_removed'}
			<p class="text-sm text-destructive">Bot was removed from the chat.</p>
		{/if}

		{#if !connected || status === 'bot_removed'}
			<div class="space-y-3">
				<div class="space-y-2">
					<Label for="tg-bot-token">Bot token</Label>
					<Input
						id="tg-bot-token"
						type="password"
						autocomplete="off"
						placeholder={settings.botTokenConfigured ? 'Saved (leave blank to keep)' : 'From @BotFather'}
						disabled={busy}
						bind:value={botTokenInput}
					/>
				</div>
				<div class="space-y-2">
					<Label for="tg-chat-id">Chat ID</Label>
					<Input
						id="tg-chat-id"
						autocomplete="off"
						placeholder="-100…"
						disabled={busy}
						bind:value={chatIdInput}
					/>
				</div>
				<Button type="button" size="sm" disabled={busy} onclick={connectManual}>
					{busy ? 'Connecting…' : 'Connect'}
				</Button>
			</div>

			{#if startGroupAvailable}
				<div class="space-y-2 border-t border-border pt-4">
					<p class="text-sm text-muted-foreground">Or add the shared bot to a group:</p>
					<Button type="button" size="sm" variant="outline" disabled={busy} onclick={connectViaLink}>
						Open Telegram
					</Button>
				</div>
			{/if}
		{:else}
			<p class="text-sm">
				Connected to
				<span class="font-medium">{settings.chatTitle?.trim() || 'Telegram group'}</span>
			</p>

			<label class="flex min-h-11 items-center gap-3">
				<Checkbox
					checked={settings.enabled !== false}
					disabled={busy}
					onCheckedChange={(checked) => {
						settings = { ...settings, enabled: Boolean(checked) };
						void savePatch({ enabled: Boolean(checked) });
					}}
				/>
				<span class="text-sm">Enabled</span>
			</label>

			<div class="space-y-2">
				<p class="text-sm font-medium">Reminders</p>
				<label class="flex min-h-11 items-center gap-3">
					<Checkbox
						checked={settings.notifyUpcoming !== false}
						disabled={busy}
						onCheckedChange={(checked) => {
							settings = { ...settings, notifyUpcoming: Boolean(checked) };
							void savePatch({ notifyUpcoming: Boolean(checked) });
						}}
					/>
					<span class="text-sm">Upcoming</span>
				</label>
				<div class="flex flex-wrap gap-2 pl-8">
					{#each [7, 3, 1] as day (day)}
						<label class="flex items-center gap-2 text-sm">
							<Checkbox
								checked={(settings.reminderDays ?? [3, 1]).includes(day)}
								disabled={busy || settings.notifyUpcoming === false}
								onCheckedChange={(checked) => toggleReminderDay(day, Boolean(checked))}
							/>
							D-{day}
						</label>
					{/each}
				</div>
				<label class="flex min-h-11 items-center gap-3">
					<Checkbox
						checked={settings.notifyDueToday !== false}
						disabled={busy}
						onCheckedChange={(checked) => {
							settings = { ...settings, notifyDueToday: Boolean(checked) };
							void savePatch({ notifyDueToday: Boolean(checked) });
						}}
					/>
					<span class="text-sm">Due today</span>
				</label>
				<label class="flex min-h-11 items-center gap-3">
					<Checkbox
						checked={settings.notifyOverdue !== false}
						disabled={busy}
						onCheckedChange={(checked) => {
							settings = { ...settings, notifyOverdue: Boolean(checked) };
							void savePatch({ notifyOverdue: Boolean(checked) });
						}}
					/>
					<span class="text-sm">Overdue</span>
				</label>
				<label class="flex min-h-11 items-center gap-3">
					<Checkbox
						checked={Boolean(settings.notifyDailyDigest)}
						disabled={busy}
						onCheckedChange={(checked) => {
							settings = { ...settings, notifyDailyDigest: Boolean(checked) };
							void savePatch({ notifyDailyDigest: Boolean(checked) });
						}}
					/>
					<span class="text-sm">Daily digest</span>
				</label>
				<label class="flex min-h-11 items-center gap-3">
					<Checkbox
						checked={settings.notifyActivity !== false}
						disabled={busy}
						onCheckedChange={(checked) => {
							settings = { ...settings, notifyActivity: Boolean(checked) };
							void savePatch({ notifyActivity: Boolean(checked) });
						}}
					/>
					<span class="text-sm">Activity</span>
				</label>
				<label class="flex min-h-11 items-center gap-3">
					<Checkbox
						checked={settings.includeAmounts !== false}
						disabled={busy}
						onCheckedChange={(checked) => {
							settings = { ...settings, includeAmounts: Boolean(checked) };
							void savePatch({ includeAmounts: Boolean(checked) });
						}}
					/>
					<span class="text-sm">Include amounts</span>
				</label>
			</div>

			<div class="space-y-3 border-t border-border pt-4">
				<p class="text-sm font-medium">Message templates</p>
				{#each editableTemplateKinds as kind (kind)}
					<div class="space-y-1">
						<Label for="tg-template-{kind}">{GROUP_TELEGRAM_TEMPLATE_LABELS[kind]}</Label>
						<Textarea
							id="tg-template-{kind}"
							rows={3}
							class="font-mono text-xs"
							disabled={busy}
							value={templateDrafts[kind] ?? ''}
							oninput={(event) => {
								templateDrafts = {
									...templateDrafts,
									[kind]: event.currentTarget.value
								};
							}}
						/>
						<p class="text-xs text-muted-foreground">{placeholdersFor(kind)}</p>
					</div>
				{/each}
				<Button type="button" size="sm" variant="secondary" disabled={busy} onclick={saveTemplates}>
					Save templates
				</Button>
			</div>

			{#if settings.lastError}
				<p class="text-sm text-destructive">{settings.lastError}</p>
			{/if}

			<div class="flex flex-wrap gap-2">
				<Button type="button" size="sm" variant="outline" disabled={busy} onclick={sendTest}>
					Send test
				</Button>
				<Button type="button" size="sm" variant="outline" disabled={busy} onclick={disconnect}>
					Disconnect
				</Button>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
