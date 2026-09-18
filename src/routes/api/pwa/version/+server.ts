import { json, type RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";

export const GET: RequestHandler = async () => {
  const disabled = env.PWA_DISABLED === "true";
  const minVersion = env.PWA_MIN_VERSION?.trim() || null;

  return json(
    { disabled, minVersion },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
};
