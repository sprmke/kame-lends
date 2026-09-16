<script lang="ts">
	import AccessPreview from '$lib/components/groups/AccessPreview.svelte';
	import GroupBadgeList from '$lib/components/groups/GroupBadgeList.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type {
		AccessPreviewData,
		AccessPreviewPerson,
		WizardLoanRow
	} from '$lib/components/groups/types';
	import { formatCount, formatCurrency, formatDateShort, formatText } from '$lib/format';
	import { partyRoleLabel } from '$lib/groups/party-role-labels';
	import { cn } from '$lib/utils';
	import Calendar from '@lucide/svelte/icons/calendar';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Users from '@lucide/svelte/icons/users';
	import UserCheck from '@lucide/svelte/icons/user-check';

	export type WizardTelegramDraft = {
		chatId: string;
		botToken: string;
		enabled: boolean;
		notifyUpcoming: boolean;
		reminderDays: number[];
		notifyDueToday: boolean;
		notifyOverdue: boolean;
		notifyDailyDigest: boolean;
		notifyActivity: boolean;
		includeAmounts: boolean;
		connectViaLinkAfterCreate: boolean;
	};

	interface Props {
		groupName: string;
		groupColorClass?: string;
		loans: WizardLoanRow[];
		preview: AccessPreviewData | null;
		previewLoading?: boolean;
		previewError?: string | null;
		createCalendarAvailable?: boolean;
		createCalendar: boolean;
		onCreateCalendarChange: (value: boolean) => void;
		telegramStartGroupAvailable?: boolean;
		telegramBotConfigured?: boolean;
		telegram: WizardTelegramDraft;
		onTelegramChange: (patch: Partial<WizardTelegramDraft>) => void;
		class?: string;
	}

	let {
		groupName,
		groupColorClass = 'bg-primary',
		loans,
		preview,
		previewLoading = false,
		previewError = null,
		createCalendarAvailable = true,
		createCalendar,
		onCreateCalendarChange,
		telegramStartGroupAvailable = false,
		telegramBotConfigured = false,
		telegram,
		onTelegramChange,
		class: className
	}: Props = $props();

	const investors = $derived(
		preview ? preview.gained.filter((person) => person.roles.includes('investor')) : []
	);
	const witnessesWithAccess = $derived(
		preview ? preview.gained.filter((person) => person.roles.includes('witness')) : []
	);
	const othersWithAccess = $derived(
		preview
			? preview.gained.filter(
					(person) =>
						!person.roles.includes('investor') && !person.roles.includes('witness')
				)
			: []
	);

	function personKey(person: AccessPreviewPerson): string {
		return person.userId ?? person.name;
	}

	function toggleReminderDay(day: number, on: boolean) {
		const current = [...telegram.reminderDays];
		const next = on
			? [...new Set([...current, day])].sort((a, b) => b - a)
			: current.filter((value) => value !== day);
		onTelegramChange({ reminderDays: next });
	}

	const showTelegramConnect = $derived(
		telegram.chatId.trim().length > 0 ||
			telegram.botToken.trim().length > 0 ||
			telegram.connectViaLinkAfterCreate
	);
</script>

<div class={cn('space-y-4', className)}>
	<div class="flex items-center gap-2">
		<span
			class={cn('size-2.5 shrink-0 rounded-full', groupColorClass)}
			aria-hidden="true"
		></span>
		<p class="min-w-0 truncate text-sm font-semibold">{formatText(groupName)}</p>
	</div>

	<section class="space-y-2" aria-labelledby="review-loans-heading">
		<div class="flex items-baseline justify-between gap-2">
			<h3 id="review-loans-heading" class="text-sm font-medium">Loans</h3>
			<span class="text-xs tabular-nums text-muted-foreground">
				{formatCount(loans.length)}
			</span>
		</div>
		<div
			class="max-h-[min(38dvh,220px)] overflow-y-auto rounded-lg border border-border bg-muted/20"
		>
			<ul class="divide-y divide-border">
				{#each loans as loan (loan.id)}
					<li class="px-3 py-2.5">
						<p class="truncate text-sm font-medium">{formatText(loan.loanName)}</p>
						<p class="text-xs text-muted-foreground">
							{loan.borrowerName ? formatText(loan.borrowerName) : 'No borrower'}
							{#if loan.dueDate}
								· Due {formatDateShort(loan.dueDate)}
							{/if}
							{#if loan.principal != null}
								· {formatCurrency(loan.principal)}
							{/if}
						</p>
						{#if loan.groupBadges && loan.groupBadges.length > 0}
							<div class="pt-1">
								<GroupBadgeList groups={loan.groupBadges} size="sm" />
							</div>
						{/if}
					</li>
				{:else}
					<li class="px-3 py-6 text-center text-sm text-muted-foreground">No loans selected.</li>
				{/each}
			</ul>
		</div>
	</section>

	{#if previewLoading || previewError || (preview && (preview.gained.length > 0 || preview.lost.length > 0))}
		<section class="space-y-3" aria-labelledby="review-access-heading">
			<h3 id="review-access-heading" class="text-sm font-medium">Access</h3>

			{#if investors.length > 0}
				<div class="space-y-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-3">
					<div class="flex items-center gap-2 text-sm font-medium">
						<Users class="size-4 text-primary" aria-hidden="true" />
						<span>Investors</span>
						<span class="text-xs font-normal tabular-nums text-muted-foreground">
							{formatCount(investors.length)}
						</span>
					</div>
					<ul class="space-y-2">
						{#each investors as person (personKey(person))}
							<li class="flex flex-wrap items-center gap-2 text-sm">
								<span class="font-medium">{formatText(person.name)}</span>
								{#each person.roles as role (role)}
									<Badge variant="secondary" class="text-[11px]">{partyRoleLabel(role)}</Badge>
								{/each}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if witnessesWithAccess.length > 0}
				<div class="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-3">
					<div class="flex items-center gap-2 text-sm font-medium">
						<UserCheck class="size-4 text-muted-foreground" aria-hidden="true" />
						<span>Witnesses</span>
						<span class="text-xs font-normal tabular-nums text-muted-foreground">
							{formatCount(witnessesWithAccess.length)}
						</span>
					</div>
					<ul class="space-y-2">
						{#each witnessesWithAccess as person (personKey(person))}
							<li class="flex flex-wrap items-center gap-2 text-sm">
								<span class="font-medium">{formatText(person.name)}</span>
								{#each person.roles as role (role)}
									<Badge variant="secondary" class="text-[11px]">{partyRoleLabel(role)}</Badge>
								{/each}
								{#if !person.hasEmail}
									<span class="text-xs text-muted-foreground">No email for calendar</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if othersWithAccess.length > 0}
				<div class="space-y-2">
					<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						{investors.length > 0 || witnessesWithAccess.length > 0
							? 'Also gets access'
							: 'Will get access'}
					</p>
					<ul class="space-y-1.5">
						{#each othersWithAccess as person (personKey(person))}
							<li class="flex flex-wrap items-center gap-2 text-sm">
								<span class="font-medium">{formatText(person.name)}</span>
								{#each person.roles as role (role)}
									<Badge variant="secondary" class="text-[11px]">{partyRoleLabel(role)}</Badge>
								{/each}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<AccessPreview
				{preview}
				loading={previewLoading}
				error={previewError}
				loanCount={loans.length}
				showSummary={false}
				showGainedList={false}
				class="pt-0"
			/>
		</section>
	{/if}

	<section class="space-y-2" aria-labelledby="review-channels-heading">
		<h3 id="review-channels-heading" class="text-sm font-medium">Channels</h3>

		{#if createCalendarAvailable}
			<div class="rounded-lg border border-border px-3 py-3">
				<div class="flex items-start gap-3">
					<Calendar class="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					<div class="min-w-0 flex-1 space-y-2">
						<p class="text-sm font-medium">Google Calendar</p>
						<label class="flex min-h-11 items-center gap-2 text-sm">
							<Checkbox
								checked={createCalendar}
								onCheckedChange={(checked) => onCreateCalendarChange(Boolean(checked))}
							/>
							Create shared calendar
						</label>
					</div>
				</div>
			</div>
		{/if}

		<div class="rounded-lg border border-border px-3 py-3">
			<div class="flex items-start gap-3">
				<MessageCircle class="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
				<div class="min-w-0 flex-1 space-y-3">
					<p class="text-sm font-medium">Telegram</p>

					<div class="space-y-2">
						<div class="space-y-1.5">
							<Label for="wizard-tg-chat-id">Chat ID</Label>
							<Input
								id="wizard-tg-chat-id"
								autocomplete="off"
								placeholder="-100…"
								value={telegram.chatId}
								oninput={(event) =>
									onTelegramChange({ chatId: event.currentTarget.value })}
							/>
						</div>
						<div class="space-y-1.5">
							<Label for="wizard-tg-bot-token">Bot token</Label>
							<Input
								id="wizard-tg-bot-token"
								type="password"
								autocomplete="off"
								placeholder={telegramBotConfigured ? 'Optional (server default)' : 'From @BotFather'}
								value={telegram.botToken}
								oninput={(event) =>
									onTelegramChange({ botToken: event.currentTarget.value })}
							/>
						</div>
					</div>

					{#if telegramStartGroupAvailable}
						<label class="flex min-h-11 items-center gap-2 text-sm">
							<Checkbox
								checked={telegram.connectViaLinkAfterCreate}
								onCheckedChange={(checked) =>
									onTelegramChange({
										connectViaLinkAfterCreate: Boolean(checked),
										...(Boolean(checked) ? { chatId: '' } : {})
									})}
							/>
							Connect via shared bot after create
						</label>
					{/if}

					<details class="group rounded-md border border-border/80 bg-muted/10">
						<summary
							class="cursor-pointer list-none px-3 py-2 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden"
						>
							Notifications
						</summary>
						<div class="space-y-1 border-t border-border px-3 py-2">
							<label class="flex min-h-10 items-center gap-2 text-sm">
								<Checkbox
									checked={telegram.enabled}
									onCheckedChange={(checked) =>
										onTelegramChange({ enabled: Boolean(checked) })}
								/>
								Enabled
							</label>
							<label class="flex min-h-10 items-center gap-2 text-sm">
								<Checkbox
									checked={telegram.notifyUpcoming}
									onCheckedChange={(checked) =>
										onTelegramChange({ notifyUpcoming: Boolean(checked) })}
								/>
								Upcoming
							</label>
							<div class="flex flex-wrap gap-2 pl-6">
								{#each [7, 3, 1] as day (day)}
									<label class="flex items-center gap-2 text-sm">
										<Checkbox
											checked={telegram.reminderDays.includes(day)}
											disabled={!telegram.notifyUpcoming}
											onCheckedChange={(checked) =>
												toggleReminderDay(day, Boolean(checked))}
										/>
										D-{day}
									</label>
								{/each}
							</div>
							<label class="flex min-h-10 items-center gap-2 text-sm">
								<Checkbox
									checked={telegram.notifyDueToday}
									onCheckedChange={(checked) =>
										onTelegramChange({ notifyDueToday: Boolean(checked) })}
								/>
								Due today
							</label>
							<label class="flex min-h-10 items-center gap-2 text-sm">
								<Checkbox
									checked={telegram.notifyOverdue}
									onCheckedChange={(checked) =>
										onTelegramChange({ notifyOverdue: Boolean(checked) })}
								/>
								Overdue
							</label>
							<label class="flex min-h-10 items-center gap-2 text-sm">
								<Checkbox
									checked={telegram.notifyDailyDigest}
									onCheckedChange={(checked) =>
										onTelegramChange({ notifyDailyDigest: Boolean(checked) })}
								/>
								Daily digest
							</label>
							<label class="flex min-h-10 items-center gap-2 text-sm">
								<Checkbox
									checked={telegram.notifyActivity}
									onCheckedChange={(checked) =>
										onTelegramChange({ notifyActivity: Boolean(checked) })}
								/>
								Activity
							</label>
							<label class="flex min-h-10 items-center gap-2 text-sm">
								<Checkbox
									checked={telegram.includeAmounts}
									onCheckedChange={(checked) =>
										onTelegramChange({ includeAmounts: Boolean(checked) })}
								/>
								Include amounts
							</label>
						</div>
					</details>

					{#if !showTelegramConnect}
						<p class="text-xs text-muted-foreground">Optional. Skip to set up later in group settings.</p>
					{/if}
				</div>
			</div>
		</div>
	</section>
</div>
