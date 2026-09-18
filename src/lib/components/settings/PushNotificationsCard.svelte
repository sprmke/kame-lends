<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { toast } from '$lib/toast';
	import {
		disablePush,
		enablePush,
		getPushState,
		type PushClientState
	} from '$lib/pwa/push';

	type Preferences = {
		notifyUpcoming: boolean;
		reminderDays: number[];
		notifyDueToday: boolean;
		notifyOverdue: boolean;
		notifyActivity: boolean;
		notifySigning: boolean;
	};

	interface Props {
		initialPreferences: Preferences;
	}

	let { initialPreferences }: Props = $props();

	let prefs = $state<Preferences>({ ...initialPreferences });
	let pushState = $state<PushClientState | null>(null);
	let busy = $state(false);

	$effect(() => {
		prefs = { ...initialPreferences };
	});

	$effect(() => {
		void refreshPushState();
	});

	async function refreshPushState() {
		pushState = await getPushState();
	}

	async function savePreferences() {
		busy = true;
		try {
			const res = await fetch('/api/push/preferences', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(prefs)
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast.error((body as { error?: string }).error ?? 'Failed to save');
				return;
			}
			toast.success('Saved');
		} finally {
			busy = false;
		}
	}

	async function toggleDevicePush(enabled: boolean) {
		busy = true;
		try {
			const ok = enabled ? await enablePush() : await disablePush();
			if (!ok) {
				toast.error('Could not update notifications on this device');
				return;
			}
			await refreshPushState();
			toast.success(enabled ? 'Notifications on' : 'Notifications off');
		} finally {
			busy = false;
		}
	}

	async function sendTest() {
		busy = true;
		try {
			const res = await fetch('/api/push/test', { method: 'POST' });
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				toast.error((body as { error?: string }).error ?? 'Test failed');
				return;
			}
			if ((body as { sent?: number }).sent) toast.success('Test sent');
			else toast.error('No active device subscription');
		} finally {
			busy = false;
		}
	}
</script>

<Card.Root>
	<Card.Header class="pb-2">
		<Card.Title>Notifications</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4">
		{#if pushState?.needsInstallFirst}
			<p class="text-sm text-muted-foreground">
				Install the app to your home screen before enabling push on iOS.
			</p>
		{:else if pushState?.supported}
			<div class="flex flex-wrap items-center gap-2">
				<Checkbox
					id="push-device"
					checked={pushState.subscribed}
					disabled={busy}
					onCheckedChange={(checked) => void toggleDevicePush(checked === true)}
				/>
				<Label for="push-device">Notifications on this device</Label>
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">
				Push is unavailable until VAPID keys are configured.
			</p>
		{/if}

		<div class="grid gap-3">
			<div class="flex items-center gap-2">
				<Checkbox
					id="notify-upcoming"
					checked={prefs.notifyUpcoming}
					onCheckedChange={(checked) => {
						prefs.notifyUpcoming = checked === true;
					}}
				/>
				<Label for="notify-upcoming">Upcoming due dates</Label>
			</div>
			<div class="flex items-center gap-2">
				<Checkbox
					id="notify-due-today"
					checked={prefs.notifyDueToday}
					onCheckedChange={(checked) => {
						prefs.notifyDueToday = checked === true;
					}}
				/>
				<Label for="notify-due-today">Due today</Label>
			</div>
			<div class="flex items-center gap-2">
				<Checkbox
					id="notify-overdue"
					checked={prefs.notifyOverdue}
					onCheckedChange={(checked) => {
						prefs.notifyOverdue = checked === true;
					}}
				/>
				<Label for="notify-overdue">Overdue</Label>
			</div>
			<div class="flex items-center gap-2">
				<Checkbox
					id="notify-activity"
					checked={prefs.notifyActivity}
					onCheckedChange={(checked) => {
						prefs.notifyActivity = checked === true;
					}}
				/>
				<Label for="notify-activity">Loan activity</Label>
			</div>
			<div class="flex items-center gap-2">
				<Checkbox
					id="notify-signing"
					checked={prefs.notifySigning}
					onCheckedChange={(checked) => {
						prefs.notifySigning = checked === true;
					}}
				/>
				<Label for="notify-signing">Signing requests</Label>
			</div>
		</div>

		<div class="flex flex-wrap gap-2">
			<Button type="button" disabled={busy} onclick={() => void savePreferences()}>Save</Button>
			{#if pushState?.subscribed}
				<Button type="button" variant="outline" disabled={busy} onclick={() => void sendTest()}>
					Send test
				</Button>
			{/if}
		</div>
	</Card.Content>
</Card.Root>
