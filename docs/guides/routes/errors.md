# Error page

**Route:** any route that throws (`src/routes/+error.svelte`)
**Status:** Documented

## Behavior

Replaces SvelteKit's fallback page (the bare `404 Not found`). Renders a centered card inside the normal shell: icon, title, one-line detail, and one or two actions. HTTP status is not shown to the user.

Server loads throw short internal reasons (`Not found`, `Read only`, `No signature slot for this account on this loan`). Those strings are never shown. Copy comes from `resolveErrorPresentation()` in `src/lib/error-presentation.ts`, keyed on HTTP status plus the failing route.

| Status  | Route               | Title                            | Actions                          |
| ------- | ------------------- | -------------------------------- | -------------------------------- |
| 403     | `/loans/[id]/sign`  | You can't sign this contract     | View loan, Dashboard             |
| 404     | `/loans/[id]/sign`  | Contract not available           | Dashboard, Go back               |
| 404     | `/sign/[token]`     | Signing link not found           | Sign in, Go back                 |
| 403     | `/loans/[id]`       | View only access                 | View loan, Dashboard             |
| 404     | `/loans/[id]`       | Loan not available               | Dashboard, Go back               |
| 403/404 | other detail routes | View only access / not available | View {entity}, Dashboard         |
| 401     | any                 | Sign in to continue              | Sign in (`callbackUrl`), Go back |
| 400     | any                 | This link isn't valid            | Dashboard, Go back               |
| 5xx     | any                 | Something went wrong             | Try again, Dashboard             |

Detail copy for a missing or forbidden record covers both cases ("It doesn't exist, or your account doesn't have access to it") because the loads return 404 for both. That keeps the message honest without confirming a record exists to someone who cannot see it.

The primary action is **Dashboard** for signed-in users and **Sign in** for everyone else, since `/loans` is admin-only. A view link is offered only where the target is known to be readable: entity 403s come from the `?edit=1` gate, and a signing 403 (`no_slot`) is only reachable when `canView` already passed.

### Layout

- Card `max-w-md`, centered vertically in the content column (`min-h-[calc(100svh-7rem)]`), so it works with the desktop sidebar and the phone top/tab bars.
- Phone: actions stack full width. Desktop (`sm+`): side by side, `min-w-32` each.
- Icon tone by kind: amber for denied, muted for missing, primary for sign-in, destructive for 5xx.
- `/sign/*` is chromeless, so the page adds the KameLends logo above the card for emailed signing links.

## Implementation

- Page: `src/routes/+error.svelte`
- Copy map: `src/lib/error-presentation.ts` (unit tests in `src/lib/error-presentation.test.ts`)
- Statuses thrown by: `src/routes/loans/[id]/+page.server.ts`, `src/routes/loans/[id]/sign/+page.server.ts`, `src/routes/sign/[token]/+page.server.ts`, and the other `[id]` detail loads
