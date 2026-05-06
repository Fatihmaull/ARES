/**
 * Object storage wrapper for ARES report artifacts (PDFs, SARIF, evidence blobs).
 *
 * Targets any S3-compatible store. Configured for Cloudflare R2 by default; works
 * with AWS S3 or MinIO by setting ASST_OBJECT_STORE_ENDPOINT to that provider.
 *
 * No production secrets live here — all credentials come from env. When env is
 * incomplete (typical in dev/test), `getObjectStore()` returns null and callers
 * fall back to the legacy filesystem path.
 */

const ENV_KEYS = {
  endpoint: "ASST_OBJECT_STORE_ENDPOINT",
  region: "ASST_OBJECT_STORE_REGION",
  bucket: "ASST_OBJECT_STORE_BUCKET",
  accessKeyId: "ASST_OBJECT_STORE_ACCESS_KEY_ID",
  secretAccessKey: "ASST_OBJECT_STORE_SECRET_ACCESS_KEY",
  publicBaseUrl: "ASST_OBJECT_STORE_PUBLIC_BASE_URL",
} as const;

export interface ObjectStoreConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional CDN/public base URL used to compose simple read links when ACLs allow. */
  publicBaseUrl?: string;
}

export interface PutObjectInput {
  key: string;
  body: Uint8Array | Buffer | string;
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export interface PutObjectResult {
  key: string;
  bucket: string;
  bytes: number;
  contentType: string;
}

export interface SignedUrlOptions {
  expiresInSeconds?: number;
}

export interface ObjectStore {
  put(input: PutObjectInput): Promise<PutObjectResult>;
  /** Returns a short-lived signed URL for the given key. */
  signedGet(key: string, options?: SignedUrlOptions): Promise<string>;
  /** Returns a publicly accessible URL when configured; null otherwise. */
  publicUrl(key: string): string | null;
  delete(key: string): Promise<void>;
  /** Underlying config (for diagnostics — never log secrets). */
  describe(): { endpoint: string; bucket: string; region: string; hasPublic: boolean };
}

function readConfig(): ObjectStoreConfig | null {
  const endpoint = process.env[ENV_KEYS.endpoint]?.trim();
  const region = process.env[ENV_KEYS.region]?.trim() || "auto";
  const bucket = process.env[ENV_KEYS.bucket]?.trim();
  const accessKeyId = process.env[ENV_KEYS.accessKeyId]?.trim();
  const secretAccessKey = process.env[ENV_KEYS.secretAccessKey]?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  const publicBaseUrl = process.env[ENV_KEYS.publicBaseUrl]?.trim() || undefined;
  return { endpoint, region, bucket, accessKeyId, secretAccessKey, publicBaseUrl };
}

let cached: ObjectStore | null | undefined;

/**
 * Returns a configured object store or null when env is incomplete.
 *
 * The wrapper intentionally avoids importing AWS SDK at module init time —
 * we lazily require it only when `put`/`signedGet` is actually called, so
 * dev environments without object-store credentials don't pay the bundle cost.
 */
export function getObjectStore(): ObjectStore | null {
  if (cached !== undefined) return cached;
  const cfg = readConfig();
  if (!cfg) {
    cached = null;
    return null;
  }
  cached = createS3CompatibleStore(cfg);
  return cached;
}

export function resetObjectStoreCache(): void {
  cached = undefined;
}

function createS3CompatibleStore(cfg: ObjectStoreConfig): ObjectStore {
  return {
    describe: () => ({
      endpoint: cfg.endpoint,
      bucket: cfg.bucket,
      region: cfg.region,
      hasPublic: Boolean(cfg.publicBaseUrl),
    }),
    publicUrl: (key) => {
      if (!cfg.publicBaseUrl) return null;
      const base = cfg.publicBaseUrl.replace(/\/+$/, "");
      const safeKey = key.replace(/^\/+/, "");
      return `${base}/${safeKey}`;
    },
    put: async (input) => {
      const { S3Client, PutObjectCommand } = await loadAwsSdk();
      const client = new S3Client({
        region: cfg.region,
        endpoint: cfg.endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: cfg.accessKeyId,
          secretAccessKey: cfg.secretAccessKey,
        },
      });
      const body = typeof input.body === "string" ? Buffer.from(input.body, "utf8") : input.body;
      await client.send(
        new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: input.key,
          Body: body,
          ContentType: input.contentType,
          CacheControl: input.cacheControl,
          Metadata: input.metadata,
        }),
      );
      return {
        key: input.key,
        bucket: cfg.bucket,
        bytes: body instanceof Buffer ? body.length : body.byteLength,
        contentType: input.contentType,
      };
    },
    signedGet: async (key, options) => {
      const { S3Client, GetObjectCommand } = await loadAwsSdk();
      const { getSignedUrl } = await loadAwsSigner();
      const client = new S3Client({
        region: cfg.region,
        endpoint: cfg.endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: cfg.accessKeyId,
          secretAccessKey: cfg.secretAccessKey,
        },
      });
      const expiresIn = options?.expiresInSeconds ?? 600;
      return getSignedUrl(client, new GetObjectCommand({ Bucket: cfg.bucket, Key: key }), {
        expiresIn,
      });
    },
    delete: async (key) => {
      const { S3Client, DeleteObjectCommand } = await loadAwsSdk();
      const client = new S3Client({
        region: cfg.region,
        endpoint: cfg.endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: cfg.accessKeyId,
          secretAccessKey: cfg.secretAccessKey,
        },
      });
      await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
    },
  };
}

type AwsSdkModule = {
  S3Client: any;
  PutObjectCommand: any;
  GetObjectCommand: any;
  DeleteObjectCommand: any;
};

type AwsSignerModule = {
  getSignedUrl: any;
};

async function loadAwsSdk(): Promise<AwsSdkModule> {
  // Dynamic import keeps cold-start fast and avoids requiring aws-sdk in dev
  // builds that don't use object storage.
  return (await import("@aws-sdk/client-s3")) as unknown as AwsSdkModule;
}

async function loadAwsSigner(): Promise<AwsSignerModule> {
  return (await import("@aws-sdk/s3-request-presigner")) as unknown as AwsSignerModule;
}

export const OBJECT_STORE_ENV_KEYS = ENV_KEYS;
