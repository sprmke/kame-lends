<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { formatText } from '$lib/format';
	import { Mail, MapPin, Phone, User } from 'lucide-svelte';

	interface Props {
		name: string;
		email?: string | null;
		contactNumber?: string | null;
		address?: string | null;
	}

	let { name, email, contactNumber, address }: Props = $props();
</script>

<Card.Root>
	<Card.Content class="space-y-3 p-3">
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			<div class="space-y-1">
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<User class="h-3 w-3" />
					<span class="text-xs">Full Name</span>
				</div>
				<p class="font-medium">{formatText(name)}</p>
			</div>

			<div class="space-y-1">
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<Mail class="h-3 w-3" />
					<span class="text-xs">Email Address</span>
				</div>
				<p class="font-medium">{email ? formatText(email) : '-'}</p>
			</div>

			<div class="space-y-1">
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<Phone class="h-3 w-3" />
					<span class="text-xs">Contact Number</span>
				</div>
				<p class="font-medium">{contactNumber ? formatText(contactNumber) : '-'}</p>
			</div>

			<div class="space-y-1 sm:col-span-2 lg:col-span-1">
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<MapPin class="h-3 w-3" />
					<span class="text-xs">Address</span>
				</div>
				<p class="font-medium">{address ? formatText(address) : '-'}</p>
			</div>
		</div>
	</Card.Content>
</Card.Root>
