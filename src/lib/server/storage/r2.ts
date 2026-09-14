import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readR2Config } from "$lib/server/storage/r2-config";

const PRESIGNED_UPLOAD_TTL_SECONDS = 300;
const PRESIGNED_DOWNLOAD_TTL_SECONDS = 300;

let cachedClient: S3Client | null = null;

export function isR2Configured(): boolean {
  return readR2Config() !== null;
}

function getClient(): S3Client {
  const config = readR2Config();
  if (!config) {
    throw new Error("Object storage is not configured.");
  }

  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
      // Presigned PUT URLs must not embed a CRC32 of an empty body.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  return cachedClient;
}

function getBucket(): string {
  const config = readR2Config();
  if (!config) {
    throw new Error("Object storage is not configured.");
  }
  return config.bucket;
}

export function extensionForContentType(contentType: string): string | null {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

export function createUploadObjectKey(userId: string, ext: string): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeExt = ext.replace(/[^a-z0-9]/gi, "");
  const fileId = crypto.randomUUID();
  return `uploads/${safeUserId}/${fileId}.${safeExt}`;
}

export async function createPresignedUploadUrl(
  objectKey: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: objectKey,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  return getSignedUrl(client, command, {
    expiresIn: PRESIGNED_UPLOAD_TTL_SECONDS,
  });
}

export async function createPresignedDownloadUrl(
  objectKey: string,
): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: objectKey,
  });

  return getSignedUrl(client, command, {
    expiresIn: PRESIGNED_DOWNLOAD_TTL_SECONDS,
  });
}

export async function putObjectBytes(
  objectKey: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObjectBytes(
  objectKey: string,
): Promise<{ body: Uint8Array; contentType: string }> {
  const client = getClient();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
    }),
  );

  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) {
    throw new Error("Object body is empty.");
  }

  return {
    body: bytes,
    contentType: response.ContentType ?? "application/octet-stream",
  };
}

export async function getObjectAsDataUrl(objectKey: string): Promise<string> {
  const { body, contentType } = await getObjectBytes(objectKey);
  const base64 = Buffer.from(body).toString("base64");
  return `data:${contentType};base64,${base64}`;
}
