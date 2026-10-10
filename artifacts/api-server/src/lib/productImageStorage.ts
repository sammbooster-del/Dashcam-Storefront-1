import { randomUUID } from "node:crypto";
import { Storage, type File } from "@google-cloud/storage";

const SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function privateBucketAndPrefix() {
  const privateDir = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  const [bucketName, ...prefixParts] = privateDir.replace(/^\/+/, "").split("/");
  if (!bucketName || prefixParts.length === 0) {
    throw new Error("PRIVATE_OBJECT_DIR is invalid");
  }
  return { bucketName, prefix: prefixParts.join("/").replace(/\/+$/, "") };
}

async function signPut(bucketName: string, objectName: string) {
  const response = await fetch(`${SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Unable to sign object upload (${response.status})`);
  const result = await response.json() as { signed_url?: string };
  if (!result.signed_url) throw new Error("Object storage returned no signed upload URL");
  return result.signed_url;
}

export async function createProductImageUpload(contentType: string) {
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) throw new Error("Unsupported image type");
  const { bucketName, prefix } = privateBucketAndPrefix();
  const id = randomUUID();
  const objectName = `${prefix}/uploads/${id}`;
  return {
    uploadURL: await signPut(bucketName, objectName),
    objectPath: `/api/storage/objects/uploads/${id}`,
  };
}

export function isProductImageObjectPath(value: string): boolean {
  return /^\/api\/storage\/objects\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function productImageIdFromPath(value: string): string | null {
  const match = value.match(/^\/api\/storage\/objects\/uploads\/([0-9a-f-]{36})$/i);
  return match?.[1] ?? null;
}

export function getProductImageFile(id: string): File {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Invalid uploaded image identifier");
  }
  const { bucketName, prefix } = privateBucketAndPrefix();
  return storage.bucket(bucketName).file(`${prefix}/uploads/${id}`);
}

function matchesImageSignature(type: string, bytes: Buffer): boolean {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/webp") return bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  return false;
}

export async function validateProductImageObject(id: string): Promise<{ file: File; contentType: string }> {
  const file = getProductImageFile(id);
  const [exists] = await file.exists();
  if (!exists) throw new Error("Uploaded image does not exist");
  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType ?? "").toLowerCase();
  const size = Number(metadata.size);
  if (!ALLOWED_IMAGE_TYPES.has(contentType) || !Number.isSafeInteger(size) || size < 1 || size > MAX_IMAGE_BYTES) {
    throw new Error("Uploaded object is not a supported image or exceeds 10 MB");
  }
  const [head] = await file.download({ start: 0, end: 11 });
  if (!matchesImageSignature(contentType, head)) {
    throw new Error("Uploaded object content does not match its image MIME type");
  }
  return { file, contentType };
}

export const PRODUCT_IMAGE_MIME_TYPES = ALLOWED_IMAGE_TYPES;
export const PRODUCT_IMAGE_MAX_BYTES = MAX_IMAGE_BYTES;