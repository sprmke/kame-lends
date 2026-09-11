/**
 * Maps a thrown SvelteKit error to the copy shown by `src/routes/+error.svelte`.
 * Server loads throw short internal reasons ("Not found", "Read only") that are
 * never shown to the user. The status plus the failing route decide the wording.
 */

export type ErrorIconKind = "denied" | "missing" | "signin" | "crash";

export type ErrorActionKind = "link" | "back" | "reload";

export interface ErrorAction {
  label: string;
  kind: ErrorActionKind;
  href?: string;
  variant: "default" | "outline";
}

export interface ErrorPresentation {
  icon: ErrorIconKind;
  title: string;
  detail: string;
  actions: ErrorAction[];
}

interface ResolveInput {
  status: number;
  pathname: string;
  search?: string;
  signedIn: boolean;
}

type ResourceKind =
  | "signing"
  | "signingLink"
  | "loan"
  | "investor"
  | "borrower"
  | "witness"
  | "debt"
  | "transaction"
  | "page";

/** Entity routes whose 403 only ever comes from the `?edit=1` gate. */
type EditGatedResource = Extract<
  ResourceKind,
  "loan" | "investor" | "borrower" | "witness" | "debt" | "transaction"
>;

const RESOURCE_ROUTES: Array<{ pattern: RegExp; resource: ResourceKind }> = [
  { pattern: /^\/loans\/[^/]+\/sign\/?$/, resource: "signing" },
  { pattern: /^\/sign\/[^/]+\/?$/, resource: "signingLink" },
  { pattern: /^\/loans\/(?!new$)[^/]+\/?$/, resource: "loan" },
  { pattern: /^\/investors\/(?!new$)[^/]+\/?$/, resource: "investor" },
  { pattern: /^\/borrowers\/(?!new$)[^/]+\/?$/, resource: "borrower" },
  { pattern: /^\/witnesses\/(?!new$)[^/]+\/?$/, resource: "witness" },
  { pattern: /^\/debts\/(?!new$)[^/]+\/?$/, resource: "debt" },
  { pattern: /^\/transactions\/(?!new$)[^/]+\/?$/, resource: "transaction" },
];

const RESOURCE_LABELS: Record<Exclude<ResourceKind, "page">, string> = {
  signing: "contract",
  signingLink: "signing link",
  loan: "loan",
  investor: "investor",
  borrower: "borrower",
  witness: "witness",
  debt: "debt",
  transaction: "transaction",
};

function resourceLabel(resource: ResourceKind): string {
  if (resource === "page") return "page";
  return RESOURCE_LABELS[resource];
}

function resolveResource(pathname: string): ResourceKind {
  for (const route of RESOURCE_ROUTES) {
    if (route.pattern.test(pathname)) return route.resource;
  }
  return "page";
}

function isEditGated(resource: ResourceKind): resource is EditGatedResource {
  return (
    resource !== "signing" && resource !== "signingLink" && resource !== "page"
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function homeAction(
  signedIn: boolean,
  variant: ErrorAction["variant"],
): ErrorAction {
  return signedIn
    ? { label: "Dashboard", kind: "link", href: "/dashboard", variant }
    : { label: "Sign in", kind: "link", href: "/signin", variant };
}

const BACK_ACTION: ErrorAction = {
  label: "Go back",
  kind: "back",
  variant: "outline",
};

function deniedCopy(
  resource: ResourceKind,
): Pick<ErrorPresentation, "title" | "detail"> {
  switch (resource) {
    case "signing":
      return {
        title: "You can't sign this contract",
        detail: "It has no signature slot for your account.",
      };
    case "signingLink":
      return {
        title: "This link is for another account",
        detail: "Sign in with the account it was sent to.",
      };
    case "page":
      return {
        title: "You don't have access",
        detail: "Your account can't open this page.",
      };
    default:
      return {
        title: "View only access",
        detail: `You can view this ${resourceLabel(resource)} but not edit it.`,
      };
  }
}

function missingCopy(
  resource: ResourceKind,
): Pick<ErrorPresentation, "title" | "detail"> {
  switch (resource) {
    case "signing":
      return {
        title: "Contract not available",
        detail: "It was removed, or your account doesn't have access to it.",
      };
    case "signingLink":
      return {
        title: "Signing link not found",
        detail:
          "It may be expired or already used. Ask the sender for a new one.",
      };
    case "page":
      return {
        title: "Page not found",
        detail: "Check the address, or go back to your dashboard.",
      };
    default:
      return {
        title: `${capitalize(resourceLabel(resource))} not available`,
        detail: "It doesn't exist, or your account doesn't have access to it.",
      };
  }
}

export function resolveErrorPresentation({
  status,
  pathname,
  search = "",
  signedIn,
}: ResolveInput): ErrorPresentation {
  const resource = resolveResource(pathname);

  if (status === 401) {
    const callbackUrl = encodeURIComponent(`${pathname}${search}`);
    return {
      icon: "signin",
      title: "Sign in to continue",
      detail: "Your session ended.",
      actions: [
        {
          label: "Sign in",
          kind: "link",
          href: `/signin?callbackUrl=${callbackUrl}`,
          variant: "default",
        },
        BACK_ACTION,
      ],
    };
  }

  if (status >= 500) {
    return {
      icon: "crash",
      title: "Something went wrong",
      detail: "The page didn't load. Try again in a moment.",
      actions: [
        { label: "Try again", kind: "reload", variant: "default" },
        homeAction(signedIn, "outline"),
      ],
    };
  }

  if (status === 403) {
    // A signing 403 only happens when the loan itself is viewable (`no_slot`),
    // and an entity 403 only comes from the `?edit=1` gate, so in both cases
    // the loan or entity page is safe to link.
    const viewHref =
      resource === "signing" ? pathname.replace(/\/sign\/?$/, "") : pathname;
    const viewLabel =
      resource === "signing" ? "View loan" : `View ${resourceLabel(resource)}`;
    const canView = resource === "signing" || isEditGated(resource);

    return {
      icon: "denied",
      ...deniedCopy(resource),
      actions: canView
        ? [
            {
              label: viewLabel,
              kind: "link",
              href: viewHref,
              variant: "default",
            },
            homeAction(signedIn, "outline"),
          ]
        : [homeAction(signedIn, "default"), BACK_ACTION],
    };
  }

  if (status === 400) {
    return {
      icon: "missing",
      title: "This link isn't valid",
      detail: "Check the address and try again.",
      actions: [homeAction(signedIn, "default"), BACK_ACTION],
    };
  }

  return {
    icon: "missing",
    ...missingCopy(resource),
    actions: [homeAction(signedIn, "default"), BACK_ACTION],
  };
}
