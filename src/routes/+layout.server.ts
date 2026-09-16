import type { LayoutServerLoad } from "./$types";
import { getNavCapabilities } from "$lib/server/access-control";
import { SHOW_GROUPS_UI } from "$lib/feature-flags";
import { getGroupsIndexForUser } from "$lib/server/cached-data";

export const load: LayoutServerLoad = async ({ locals }) => {
  const session = locals.session;
  const navCapabilities = session?.user?.id
    ? await getNavCapabilities(session.user.id)
    : {
        isAdminWorkspace: false,
        hasInvestments: false,
        hasBorrowed: false,
        hasWitnessed: false,
        hasGroups: false,
      };

  // Single rollout gate: hide nav + chips until SHOW_GROUPS_UI is flipped.
  // Any signed-in user can open Groups (owned + shared); membership no longer gates the nav item.
  const gatedCaps = {
    ...navCapabilities,
    hasGroups: SHOW_GROUPS_UI && Boolean(session?.user?.id),
  };

  const groupsIndex =
    SHOW_GROUPS_UI && session?.user?.id
      ? await getGroupsIndexForUser(session.user.id)
      : [];

  return {
    session,
    navCapabilities: gatedCaps,
    groupsIndex,
  };
};
