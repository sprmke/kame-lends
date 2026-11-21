<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { toast } from '$lib/toast';
	import { EMAIL_REMINDER_DAY_OPTIONS } from '$lib/schemas/email-preferences';

	type Preferences = {
		userId?: string | null;
		emailEnabled: boolean;
		notifyActivity: boolean;
		notifySigningRequests: boolean;
		notifySigningReminders: boolean;
		signingReminderFirstAfterDays: number;
		signingReminderRepeatEveryDays: number;
		notifyDueReminders: boolean;
		reminderDays: number[];
		notifyDueToday: boolean;
		notifyOverdue: boolean;
		overdueRepeatEveryDays: number;
		includeAmounts: boolean;
	};

	interface Props {
		initialPreferences: Preferences;
		emailConfigured: boolean;
	}

	let { initialPreferences, emailConfigured }: Props = $props();

	function dayChecksFrom(days: number[]): Record<number, boolean> {
		return Object.fromEntries(
			EMAIL_REMINDER_DAY_OPTIONS.map((day) => [day, days.includes(day)]),
		) as Record<number, boolean>;
	}

	let prefs = $state(initialPreferences);
	let dayChecks = $state<Record<number, boolean>>(
		dayChecksFrom(initialPreferences.reminderDays),
	);
	$effect.pre(() => {
		prefs = initialPreferences;
		dayChecks = dayChecksFrom(initialPreferences.reminderDays);
	});
	let busy = $state(false);

	function selectedReminderDays(): number[] {
		return EMAIL_REMINDER_DAY_OPTIONS.filter((day) => dayChecks[day]).sort(
			(a, b) => b - a,
		);
	}

	async function savePreferences() {
		busy = true;
		try {
			const reminderDays = selectedReminderDays();
			if (prefs.notifyDueReminders && reminderDays.length === 0) {
				toast.error('Choose at least one reminder day.');
				return;
			}

			const payload = { ...prefs, reminderDays };
			delete payload.userId;
			const res = await fetch('/api/email/preferences', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast.error((body as { error?: string }).error ?? 'Failed to save');
				return;
			}
			const saved = (await res.json()) as Preferences;
			prefs = saved;
			dayChecks = dayChecksFrom(saved.reminderDays);
			toast.success('Saved');
		} finally {
			busy = false;
		}
	}

	async function sendTest() {
		busy = true;
		try {
			const res = await fetch('/api/email/test', { method: 'POST' });
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				toast.error((body as { error?: string }).error ?? 'Test failed');
				return;
			}
			toast.success('Test sent');
		} finally {
			busy = false;
		}
	}
</script>

<Card.Root>
	<Card.Header class="pb-2">
		<Card.Title>Email notifications</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4">
		{#if !emailConfigured}
			<p class="text-muted-foreground text-sm">
				Email is not configured on this server.
			</p>
		{/if}

		<div class="flex items-center gap-2">
			<Checkbox id="email-enabled" bind:checked={prefs.emailEnabled} />
			<Label for="email-enabled">Send email notifications</Label>
		</div>

		<div class="grid gap-3 sm:grid-cols-2">
			<div class="flex items-center gap-2">
				<Checkbox id="email-activity" bind:checked={prefs.notifyActivity} />
				<Label for="email-activity">Loan and payment updates</Label>
			</div>
			<div class="flex items-center gap-2">
				<Checkbox
					id="email-signing-requests"
					bind:checked={prefs.notifySigningRequests}
				/>
				<Label for="email-signing-requests">Signing requests</Label>
			</div>
		</div>

		<div class="border-border/70 space-y-3 rounded-2xl border p-4">
			<div class="flex items-center gap-2">
				<Checkbox
					id="email-signing-reminders"
					bind:checked={prefs.notifySigningReminders}
				/>
				<Label for="email-signing-reminders">Unsigned contract reminders</Label>
			</div>
			<div class="grid gap-3 sm:grid-cols-2">
				<div class="space-y-1">
					<Label
						for="signing-first-after"
						class="text-muted-foreground text-xs"
					>
						First reminder after (days)
					</Label>
					<Input
						id="signing-first-after"
						type="number"
						min="0"
						max="30"
						bind:value={prefs.signingReminderFirstAfterDays}
					/>
				</div>
				<div class="space-y-1">
					<Label for="signing-repeat" class="text-muted-foreground text-xs">
						Repeat every (days)
					</Label>
					<Input
						id="signing-repeat"
						type="number"
						min="1"
						max="30"
						bind:value={prefs.signingReminderRepeatEveryDays}
					/>
				</div>
			</div>
		</div>

		<div class="border-border/70 space-y-3 rounded-2xl border p-4">
			<div class="flex items-center gap-2">
				<Checkbox
					id="email-due-reminders"
					bind:checked={prefs.notifyDueReminders}
				/>
				<Label for="email-due-reminders">Upcoming due dates</Label>
			</div>
			<div class="flex flex-wrap gap-3">
				{#each EMAIL_REMINDER_DAY_OPTIONS as day (day)}
					<label class="flex items-center gap-1.5 text-sm">
						<Checkbox
							bind:checked={dayChecks[day]}
							disabled={!prefs.notifyDueReminders}
						/>
						{day}d
					</label>
				{/each}
			</div>
			<div class="space-y-3">
				<div class="flex items-center gap-2">
					<Checkbox id="email-due-today" bind:checked={prefs.notifyDueToday} />
					<Label for="email-due-today">Due today</Label>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<Checkbox id="email-overdue" bind:checked={prefs.notifyOverdue} />
					<Label for="email-overdue">Overdue</Label>
					<Label
						for="overdue-repeat"
						class="text-muted-foreground ml-2 text-xs"
					>
						Repeat every
					</Label>
					<Input
						id="overdue-repeat"
						type="number"
						min="1"
						max="30"
						class="w-20"
						disabled={!prefs.notifyOverdue}
						bind:value={prefs.overdueRepeatEveryDays}
					/>
					<span class="text-muted-foreground text-xs">days</span>
				</div>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<Checkbox
				id="email-include-amounts"
				bind:checked={prefs.includeAmounts}
			/>
			<Label for="email-include-amounts">Show amounts in emails</Label>
		</div>

		<div class="flex flex-wrap gap-2">
			<Button
				type="button"
				aria-label="Save email preferences"
				class="text-primary-ink"
				disabled={busy}
				onclick={() => void savePreferences()}>Save</Button
			>
			<Button
				type="button"
				variant="outline"
				aria-label="Send test email"
				disabled={busy || !emailConfigured}
				onclick={() => void sendTest()}
			>
				Send test
			</Button>
		</div>
	</Card.Content>
</Card.Root>
