<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Avatar from '$lib/components/ui/avatar';
	import PriceVisibilityToggle from '$lib/components/common/PriceVisibilityToggle.svelte';
	import { isNavActive, type AppNavItem } from '$lib/nav/app-nav';
	import { cn } from '$lib/utils';
	import { LogOut } from 'lucide-svelte';

	interface UserInfo {
		name?: string | null;
		email?: string | null;
		image?: string | null;
	}

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		pathname: string;
		moreNavItems: AppNavItem[];
		user: UserInfo;
	}

	let { open, onOpenChange, pathname, moreNavItems, user }: Props = $props();

	const userInitials = $derived(
		user.name
			? user.name
					.split(' ')
					.map((n) => n[0])
					.join('')
					.toUpperCase()
			: (user.email?.[0]?.toUpperCase() ?? 'U')
	);
</script>

<Sheet.Root {open} {onOpenChange}>
	<Sheet.Content side="bottom" class="gap-0 p-0" showCloseButton={true}>
		<Sheet.Header class="border-b border-border/60">
			<Sheet.Title>More</Sheet.Title>
		</Sheet.Header>

		<div class="flex items-center gap-3 px-4 py-3">
			<Avatar.Root class="h-11 w-11 ring-1 ring-border">
				<Avatar.Image src={user.image ?? undefined} alt={user.name ?? 'User'} />
				<Avatar.Fallback class="bg-primary text-sm font-semibold text-primary-foreground">
					{userInitials}
				</Avatar.Fallback>
			</Avatar.Root>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium">{user.name ?? 'User'}</p>
				<p class="truncate text-xs text-muted-foreground">{user.email}</p>
			</div>
			<PriceVisibilityToggle />
		</div>

		<nav class="flex flex-col gap-0.5 px-2 pb-2" aria-label="More">
			{#each moreNavItems as item (item.id)}
				{@const active = isNavActive(pathname, item.href)}
				<a
					href={item.href}
					data-sveltekit-preload-data="hover"
					class={cn(
						'touch-target flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
						active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent'
					)}
					onclick={() => onOpenChange(false)}
				>
					<item.icon class="h-5 w-5 shrink-0" />
					<span>{item.title}</span>
				</a>
			{/each}
		</nav>

		<div class="border-t border-border/60 p-2">
			<form method="POST" action="/auth/signout">
				<button
					type="submit"
					class="touch-target flex w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-destructive hover:bg-destructive/5"
				>
					<LogOut class="h-4 w-4" />
					Sign out
				</button>
			</form>
		</div>
	</Sheet.Content>
</Sheet.Root>
