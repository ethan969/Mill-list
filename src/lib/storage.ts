import { promises as fs } from "fs";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.STORAGE_BUCKET;
const ENDPOINT = process.env.STORAGE_ENDPOINT;
const REGION = process.env.STORAGE_REGION || "auto";
const ACCESS_KEY_ID = process.env.STORAGE_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.STORAGE_SECRET_ACCESS_KEY;
const FORCE_PATH_STYLE = process.env.STORAGE_FORCE_PATH_STYLE !== "false";

export const isCloudStorageConfigured = Boolean(
  BUCKET && ACCESS_KEY_ID && SECRET_ACCESS_KEY
);

const LOCAL_ROOT = path.join(process.cwd(), "storage");

let s3Client: S3Client | null = null;
function getClient(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: REGION,
      endpoint: ENDPOINT,
      forcePathStyle: FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: ACCESS_KEY_ID!,
        secretAccessKey: SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

function localPath(key: string): string {
  const safe = key.replace(/\.\./g, "");
  return path.join(LOCAL_ROOT, safe);
}

/** Persist a file's bytes under `key`. */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  if (isCloudStorageConfigured) {
    await getClient().send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    return;
  }

  const dest = localPath(key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, body);
}

/** Read a file's full bytes back into memory. */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  if (isCloudStorageConfigured) {
    const res = await getClient().send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Object not found: ${key}`);
    return Buffer.from(bytes);
  }

  return fs.readFile(localPath(key));
}

/** Get a Web ReadableStream for the object, for proxying large files without buffering. */
export async function getObjectWebStream(
  key: string
): Promise<ReadableStream<Uint8Array>> {
  if (isCloudStorageConfigured) {
    const res = await getClient().send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );
    const webStream = res.Body?.transformToWebStream();
    if (!webStream) throw new Error(`Object not found: ${key}`);
    return webStream as ReadableStream<Uint8Array>;
  }

  const buffer = await fs.readFile(localPath(key));
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });
}

/**
 * Confirm an object actually landed in cloud storage (after a presigned
 * direct upload) and get its real size, rather than trusting whatever size
 * the browser claimed. Returns null if the object doesn't exist.
 */
export async function headObject(
  key: string
): Promise<{ size: number } | null> {
  if (!isCloudStorageConfigured) {
    try {
      const stat = await fs.stat(localPath(key));
      return { size: stat.size };
    } catch {
      return null;
    }
  }

  try {
    const res = await getClient().send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: key })
    );
    return { size: res.ContentLength ?? 0 };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (isCloudStorageConfigured) {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
    );
    return;
  }

  await fs.rm(localPath(key), { force: true });
}

/** Build a storage key for a newly uploaded project asset. */
export function buildAssetKey(
  projectId: string,
  category: string,
  id: string,
  fileName: string
): string {
  const ext = path.extname(fileName) || "";
  return `projects/${projectId}/${category}/${id}${ext}`;
}

/**
 * A short-lived URL the browser can PUT a file to directly, bypassing our
 * server entirely for the file bytes — the only way to accept files larger
 * than a serverless platform's request body limit (Vercel caps it at
 * 4.5MB). Only meaningful when cloud storage is configured; there's no
 * equivalent for the local-disk fallback, which routes uploads through the
 * server as before and is only really meant for development anyway.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

/**
 * A short-lived URL the browser can GET a file from directly. Used so the
 * flick-through viewer reads straight from storage — which natively
 * supports HTTP Range requests for progressive page-by-page loading —
 * instead of proxying the whole file through this server on every open
 * (our own proxy route has no Range support, so a large document had to
 * download in full before the first page could render, on every visit).
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 900
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}
