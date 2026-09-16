import type { PageServerLoad } from "./$types";
import { env } from "$env/dynamic/private";
import { getCachedGroupsForUser } from "$lib/server/cached-data";
import { mapGroupToListCard } from "$lib/groups/group-list-map";
import { requireUserSession } from "$lib/server/request-auth";
import { readGoogleServiceAccountCredentials } from "$lib/server/google-calendar-config";
import { isTelegramConfigured } from "$lib/server/telegram/config";

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  event.depends("app:groups");

  const userId = session.user.id;

  const items = getCachedGroupsForUser(userId).then((groups) =>
    groups.map((group) => mapGroupToListCard(group, userId)),
  );

  return {
    items,
    currentUserId: userId,
    canCreate: true,
    createCalendarAvailable: readGoogleServiceAccountCredentials(env) !== null,
    telegramStartGroupAvailable: isTelegramConfigured(),
    telegramBotConfigured: isTelegramConfigured(),
  };
};
