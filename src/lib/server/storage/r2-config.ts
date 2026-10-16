import { readEnv } from "$lib/server/read-env";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

export function readR2Config(): R2Config | null {
  const accountId = readEnv("R2_ACCOUNT_ID");
  const accessKeyId = readEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = readEnv("R2_SECRET_ACCESS_KEY");
  const bucket = readEnv("R2_BUCKET_NAME");
  const endpoint =
    readEnv("R2_ENDPOINT") ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
  };
}
