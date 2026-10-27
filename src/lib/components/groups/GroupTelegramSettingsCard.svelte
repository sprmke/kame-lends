<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { toast } from '$lib/toast';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';
	import { MessageCircle } from 'lucide-svelte';
	import TelegramTemplateEditor from '$lib/components/groups/TelegramTemplateEditor.svelte';
	import {
		GROUP_TELEGRAM_TEMPLATE_CATEGORIES,
		GROUP_TELEGRAM_TEMPLATE_KINDS,
		GROUP_TELEGRAM_TEMPLATE_LABELS,
		type GroupTelegramTemplateCategoryId,
		type GroupTelegramTemplateKind
	} from '$lib/groups/group-telegram-templates';
	import {
		groupSettingsActionClass,
		groupSettingsActionsLayoutClass
	} from '$lib/groups/group-settings-actions';

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
		notifyUnsigned?: boolean;
		signingReminderIntervalHours?: number;
		requireBorrowerSignature?: boolean;
		requireInvestorSignature?: boolean;
		requireWitnessSignature?: boolean;
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

	let settings = $state<TelegramSettings>({ ...(initial ?? {}) });
	let busy = $state(false);
	let pollTimer: ReturnType<typeof setInterval> | undefined;
	let botTokenInput = $state('');
	let chatIdInput = $state('');
	let templateDrafts = $state<Partial<Record<GroupTelegramTemplateKind, string>>>({});
	let activeCategory = $state<GroupTelegramTemplateCategoryId>('reminders');
	let activeTemplate = $state<GroupTelegramTemplateKind>('upcoming');

	const categoryKinds = $derived(
		GROUP_TELEGRAM_TEMPLATE_CATEGORIES.find((row) => row.id === activeCategory)?.kinds ??
			GROUP_TELEGRAM_TEMPLATE_CATEGORIES[0].kinds
	);

	function selectCategory(id: GroupTelegramTemplateCategoryId) {
		activeCategory = id;
		const kinds =
			GROUP_TELEGRAM_TEMPLATE_CATEGORIES.find((row) => row.id === id)?.kinds ?? [];
		const next = kinds[0];
		if (next && !(kinds as readonly string[]).includes(activeTemplate)) {
			activeTemplate = next;
		}
	}

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
	const telegramEnabled = $derived(settings.enabled !== false);
	const notificationsLocked = $derived(busy || !telegramEnabled);
	const reminderLeadOptions = [
		{ days: 7, label: '7 days' },
		{ days: 3, label: '3 days' },
		{ days: 1, label: '1 day' }
	] as const;
	const signingIntervalOptions = [
		{ hours: 1, label: '1 hour' },
		{ hours: 2, label: '2 hours' },
		{ hours: 4, label: '4 hours' },
		{ hours: 6, label: '6 hours' },
		{ hours: 12, label: '12 hours' },
		{ hours: 24, label: 'Daily' }
	] as const;
	const signingRoleOptions = [
		{ key: 'requireBorrowerSignature', label: 'Borrower' },
		{ key: 'requireInvestorSignature', label: 'Investor' },
		{ key: 'requireWitnessSignature', label: 'Witness' }
	] as const;
	const settingRowClass =
		'flex min-h-11 w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm';

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
		for (const kind of GROUP_TELEGRAM_TEMPLATE_KINDS) {
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

	function signingRoleOn(
		key: (typeof signingRoleOptions)[number]['key']
	): boolean {
		if (key === 'requireWitnessSignature') {
			return settings.requireWitnessSignature === true;
		}
		return settings[key] !== false;
	}

	function toggleSigningRole(
		key: (typeof signingRoleOptions)[number]['key'],
		on: boolean
	) {
		const next = {
			requireBorrowerSignature: signingRoleOn('requireBorrowerSignature'),
			requireInvestorSignature: signingRoleOn('requireInvestorSignature'),
			requireWitnessSignature: signingRoleOn('requireWitnessSignature'),
			[key]: on
		};
		if (
			!next.requireBorrowerSignature &&
			!next.requireInvestorSignature &&
			!next.requireWitnessSignature
		) {
			toast.error('Pick at least one');
			return;
		}
		settings = { ...settings, [key]: on };
		void savePatch({ [key]: on });
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
				<Button
					type="button"
					variant="default"
					class={groupSettingsActionClass}
					disabled={busy}
					onclick={connectManual}
				>
					{busy ? 'Connecting…' : 'Connect'}
				</Button>
			</div>

			{#if startGroupAvailable}
				<div class="space-y-2 border-t border-border pt-4">
					<p class="text-sm text-muted-foreground">Or add the shared bot to a group:</p>
					<Button
						type="button"
						variant="outline"
						class={groupSettingsActionClass}
						disabled={busy}
						onclick={connectViaLink}
					>
						Open Telegram
					</Button>
				</div>
			{/if}
		{:else}
			<div
				class="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-3"
			>
				<div class="min-w-0 flex-1">
					<p class="text-xs font-medium text-muted-foreground">Connected</p>
					<p class="truncate text-sm font-medium">
						{settings.chatTitle?.trim() || 'Telegram group'}
					</p>
				</div>
				<Badge
					variant="secondary"
					class="shrink-0 border-0 bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
				>
					Live
				</Badge>
			</div>

			<label
				class="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5"
			>
				<span class="text-sm font-medium">Notifications</span>
				<Checkbox
					checked={telegramEnabled}
					disabled={busy}
					onCheckedChange={(checked) => {
						settings = { ...settings, enabled: Boolean(checked) };
						void savePatch({ enabled: Boolean(checked) });
					}}
				/>
			</label>

			<div
				class={cn(
					'space-y-4 transition-opacity',
					!telegramEnabled && 'pointer-events-none opacity-45'
				)}
			>
				<section class="space-y-2" aria-labelledby="tg-notify-reminders">
					<h3 id="tg-notify-reminders" class="text-sm font-medium">Reminders</h3>
					<div
						class="overflow-hidden rounded-xl border border-border/60 bg-card divide-y divide-border/60"
					>
						<label class={settingRowClass}>
							<Checkbox
								checked={settings.notifyUpcoming !== false}
								disabled={notificationsLocked}
								onCheckedChange={(checked) => {
									settings = { ...settings, notifyUpcoming: Boolean(checked) };
									void savePatch({ notifyUpcoming: Boolean(checked) });
								}}
							/>
							<span class="flex-1 font-medium">Upcoming due dates</span>
						</label>
						{#if settings.notifyUpcoming !== false}
							<div class="space-y-2 bg-muted/15 px-3 py-3">
								<p class="text-xs text-muted-foreground">Notify before due</p>
								<div class="grid grid-cols-3 gap-2">
									{#each reminderLeadOptions as option (option.days)}
										{@const selected = (settings.reminderDays ?? [3, 1]).includes(
											option.days
										)}
										<button
											type="button"
											class={cn(
												'touch-target min-h-11 rounded-xl border px-2 text-sm font-medium transition-colors',
												selected
													? 'border-primary bg-primary/10 text-foreground'
													: 'border-border/60 bg-card text-muted-foreground hover:bg-muted/40'
											)}
											aria-pressed={selected}
											aria-label="{option.label} before due"
											disabled={notificationsLocked}
											onclick={() => toggleReminderDay(option.days, !selected)}
										>
											{option.label}
										</button>
									{/each}
								</div>
							</div>
						{/if}
						<label class={settingRowClass}>
							<Checkbox
								checked={settings.notifyDueToday !== false}
								disabled={notificationsLocked}
								onCheckedChange={(checked) => {
									settings = { ...settings, notifyDueToday: Boolean(checked) };
									void savePatch({ notifyDueToday: Boolean(checked) });
								}}
							/>
							<span class="flex-1">Due today</span>
						</label>
						<label class={settingRowClass}>
							<Checkbox
								checked={settings.notifyOverdue !== false}
								disabled={notificationsLocked}
								onCheckedChange={(checked) => {
									settings = { ...settings, notifyOverdue: Boolean(checked) };
									void savePatch({ notifyOverdue: Boolean(checked) });
								}}
							/>
							<span class="flex-1">Overdue</span>
						</label>
						<label class={settingRowClass}>
							<Checkbox
								checked={settings.notifyUnsigned !== false}
								disabled={notificationsLocked}
								onCheckedChange={(checked) => {
									settings = { ...settings, notifyUnsigned: Boolean(checked) };
									void savePatch({ notifyUnsigned: Boolean(checked) });
								}}
							/>
							<span class="flex-1 font-medium">Unsigned contracts</span>
						</label>
						{#if settings.notifyUnsigned !== false}
							<div class="space-y-3 bg-muted/15 px-3 py-3">
								<div class="space-y-2">
									<p class="text-xs text-muted-foreground">How often</p>
									<div class="grid grid-cols-3 gap-2">
										{#each signingIntervalOptions as option (option.hours)}
											{@const selected =
												(settings.signingReminderIntervalHours ?? 1) === option.hours}
											<button
												type="button"
												class={cn(
													'touch-target min-h-11 rounded-xl border px-2 text-sm font-medium transition-colors',
													selected
														? 'border-primary bg-primary/10 text-foreground'
														: 'border-border/60 bg-card text-muted-foreground hover:bg-muted/40'
												)}
												aria-pressed={selected}
												disabled={notificationsLocked}
												onclick={() => {
													settings = {
														...settings,
														signingReminderIntervalHours: option.hours
													};
													void savePatch({
														signingReminderIntervalHours: option.hours
													});
												}}
											>
												{option.label}
											</button>
										{/each}
									</div>
								</div>
								<div class="space-y-2">
									<p class="text-xs text-muted-foreground">Must sign</p>
									<div class="grid grid-cols-3 gap-2">
										{#each signingRoleOptions as option (option.key)}
											{@const selected = signingRoleOn(option.key)}
											<button
												type="button"
												class={cn(
													'touch-target min-h-11 rounded-xl border px-2 text-sm font-medium transition-colors',
													selected
														? 'border-primary bg-primary/10 text-foreground'
														: 'border-border/60 bg-card text-muted-foreground hover:bg-muted/40'
												)}
												aria-pressed={selected}
												disabled={notificationsLocked}
												onclick={() => toggleSigningRole(option.key, !selected)}
											>
												{option.label}
											</button>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>
				</section>

				<section class="space-y-2" aria-labelledby="tg-notify-other">
					<h3 id="tg-notify-other" class="text-sm font-medium">Updates</h3>
					<div
						class="overflow-hidden rounded-xl border border-border/60 bg-card divide-y divide-border/60"
					>
						<label class={settingRowClass}>
							<Checkbox
								checked={Boolean(settings.notifyDailyDigest)}
								disabled={notificationsLocked}
								onCheckedChange={(checked) => {
									settings = { ...settings, notifyDailyDigest: Boolean(checked) };
									void savePatch({ notifyDailyDigest: Boolean(checked) });
								}}
							/>
							<span class="flex-1">Daily digest</span>
						</label>
						<label class={settingRowClass}>
							<Checkbox
								checked={settings.notifyActivity !== false}
								disabled={notificationsLocked}
								onCheckedChange={(checked) => {
									settings = { ...settings, notifyActivity: Boolean(checked) };
									void savePatch({ notifyActivity: Boolean(checked) });
								}}
							/>
							<span class="flex-1">Loan activity</span>
						</label>
						<label class={settingRowClass}>
							<Checkbox
								checked={settings.includeAmounts !== false}
								disabled={notificationsLocked}
								onCheckedChange={(checked) => {
									settings = { ...settings, includeAmounts: Boolean(checked) };
									void savePatch({ includeAmounts: Boolean(checked) });
								}}
							/>
							<span class="flex-1">Show amounts</span>
						</label>
					</div>
				</section>
			</div>

			<div class="space-y-3 border-t border-border pt-4">
				<p class="text-sm font-medium">Message templates</p>
				<div
					class="-mx-1 flex gap-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					role="tablist"
					aria-label="Template categories"
				>
					{#each GROUP_TELEGRAM_TEMPLATE_CATEGORIES as category (category.id)}
						<button
							type="button"
							role="tab"
							class="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium {activeCategory ===
							category.id
								? 'bg-primary/10 text-foreground'
								: 'text-muted-foreground'}"
							aria-selected={activeCategory === category.id}
							disabled={busy}
							onclick={() => selectCategory(category.id)}
						>
							{category.label}
						</button>
					{/each}
				</div>
				<div
					class="-mx-1 flex gap-0 overflow-x-auto border-b border-border/60 px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					role="tablist"
					aria-label="Message templates"
				>
					{#each categoryKinds as kind (kind)}
						<button
							type="button"
							role="tab"
							class="inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium {activeTemplate ===
							kind
								? 'border-primary text-foreground'
								: 'border-transparent text-muted-foreground'}"
							aria-selected={activeTemplate === kind}
							disabled={busy}
							onclick={() => (activeTemplate = kind)}
						>
							{GROUP_TELEGRAM_TEMPLATE_LABELS[kind]}
						</button>
					{/each}
				</div>
				<TelegramTemplateEditor
					kind={activeTemplate}
					value={templateDrafts[activeTemplate] ?? ''}
					showLabel={false}
					disabled={busy}
					onchange={(next) => {
						templateDrafts = { ...templateDrafts, [activeTemplate]: next };
					}}
				/>
				<Button
					type="button"
					variant="outline"
					class={groupSettingsActionClass}
					disabled={busy}
					onclick={saveTemplates}
				>
					Save templates
				</Button>
			</div>

			{#if settings.lastError}
				<p class="text-sm text-destructive">{settings.lastError}</p>
			{/if}

			<div class={groupSettingsActionsLayoutClass}>
				<Button
					type="button"
					variant="outline"
					class={groupSettingsActionClass}
					disabled={busy}
					onclick={sendTest}
				>
					Send test
				</Button>
				<Button
					type="button"
					variant="destructive"
					class={groupSettingsActionClass}
					disabled={busy}
					onclick={disconnect}
				>
					Disconnect
				</Button>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
