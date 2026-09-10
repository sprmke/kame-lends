<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Avatar from '$lib/components/ui/avatar';
	import PriceVisibilityToggle from '$lib/components/common/PriceVisibilityToggle.svelte';
	import ThemeToggle from '$lib/components/theme/ThemeToggle.svelte';
	import { isNavActive, type AppNavGroup } from '$lib/nav/app-nav';
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
		moreNavGroups: AppNavGroup[];
		user: UserInfo;
	}

	let { open, onOpenChange, pathname, moreNavGroups, user }: Props = $props();

	const moreNavItems = $derived(moreNavGroups.flatMap((group) => group.items));

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
	<Sheet.Content
		side="bottom"
		showCloseButton={true}
		class="gap-0 overflow-hidden p-0 pb-0!"
	>
		<Sheet.Header class="sr-only">
			<Sheet.Title>More</Sheet.Title>
		</Sheet.Header>

		<div class="flex min-h-0 flex-col">
			{#if moreNavItems.length > 0}
				<nav
					class="min-h-0 overflow-y-auto overscroll-contain px-3 pt-2 pb-2 pr-12 [-webkit-overflow-scrolling:touch]"
					aria-label="More"
				>
					{#each moreNavGroups as group, groupIndex (group.id)}
						{#if groupIndex > 0}
							<div class="my-2 border-t border-border/50" role="separator"></div>
						{/if}
						{#if group.label}
							<p
								class="mb-1 px-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
							>
								{group.label}
							</p>
						{/if}
						<div class="space-y-0.5">
							{#each group.items as item (item.id)}
								{@const active = isNavActive(pathname, item.href)}
								<a
									href={item.href}
									data-sveltekit-preload-data="hover"
									aria-current={active ? 'page' : undefined}
									class={cn(
										'native-press flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium leading-snug transition-colors',
										active
											? 'bg-primary/10 text-primary'
											: 'text-foreground hover:bg-muted/60 active:bg-muted'
									)}
									onclick={() => onOpenChange(false)}
								>
									<item.icon class="size-4 shrink-0 opacity-90" strokeWidth={1.75} />
									<span class="min-w-0 truncate">{item.title}</span>
								</a>
							{/each}
						</div>
					{/each}
				</nav>
			{/if}

			<div
				class={cn(
					'shrink-0 bg-popover px-3 pb-[max(1rem,var(--safe-area-bottom))]',
					moreNavItems.length === 0 && 'pt-2 pr-12'
				)}
			>
				<div
					class={cn(
						'flex flex-col gap-3.5 pt-4',
						moreNavItems.length > 0 && 'border-t border-border/60'
					)}
				>
					<div class="flex min-h-11 items-center gap-1">
						<div class="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5">
							<Avatar.Root class="size-8 shrink-0 ring-2 ring-background">
								<Avatar.Image src={user.image ?? undefined} alt={user.name ?? 'User'} />
								<Avatar.Fallback
									class="bg-primary text-[11px] font-semibold text-primary-foreground"
								>
									{userInitials}
								</Avatar.Fallback>
							</Avatar.Root>
							<div class="min-w-0 flex-1">
								<p class="truncate text-[13px] font-semibold leading-tight">
									{user.name ?? 'User'}
								</p>
								{#if user.email}
									<p class="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
										{user.email}
									</p>
								{/if}
							</div>
						</div>
						<PriceVisibilityToggle
							class="size-10 shrink-0 rounded-lg border-border/60 bg-muted shadow-none [&_svg]:size-4"
						/>
					</div>

					<ThemeToggle variant="segmented" class="w-full shadow-none" />

					<form method="POST" action="/auth/signout?/signOut">
						<button
							type="submit"
							class="native-press flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
						>
							<LogOut class="size-3.5 shrink-0" strokeWidth={1.75} />
							Sign out
						</button>
					</form>
				</div>
			</div>
		</div>
	</Sheet.Content>
</Sheet.Root>
