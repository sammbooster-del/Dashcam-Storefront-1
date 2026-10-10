import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getProductImageFile, productImageIdFromPath } from "./productImageStorage";
import { logger } from "./logger";

export type InlineEmailImage = { filename: string; content: string; content_type: string; content_id: string };

export async function emailThumbnail(bytes: Buffer) {
  return sharp(bytes, { limitInputPixels: 32_000_000 })
    .rotate().resize(120, 120, { fit: "contain", background: "#f4f5f0" })
    .flatten({ background: "#f4f5f0" }).jpeg({ quality: 82 }).toBuffer();
}

async function sourceImage(imageUrl: string) {
  const objectId = productImageIdFromPath(imageUrl);
  if (objectId) {
    const file = getProductImageFile(objectId);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size) > 10 * 1024 * 1024) throw new Error("Product image exceeds size limit");
    const [bytes] = await file.download();
    return bytes;
  }
  // Only known catalog files, never arbitrary URLs or filesystem paths.
  if (!/^\/images\/[a-zA-Z0-9._-]+$/.test(imageUrl)) return null;
  for (const dir of ["../driveguard-store/public", "../driveguard-store/dist/public", "artifacts/driveguard-store/dist/public", "artifacts/driveguard-store/public"]) {
    try { return await readFile(path.resolve(process.cwd(), dir, imageUrl.slice(1))); }
    catch { /* Try the source and deployed static directory layouts. */ }
  }
  throw new Error("Product image file is unavailable");
}

export async function prepareEmailImages(products: { id: number; imageUrl: string }[]) {
  const images: Record<number, string> = {};
  const attachments: InlineEmailImage[] = [];
  await Promise.all(products.map(async product => {
    images[product.id] = product.imageUrl;
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const thumbnail = await Promise.race([
        (async () => {
          const bytes = await sourceImage(product.imageUrl);
          return bytes ? await emailThumbnail(bytes) : null;
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Product image timed out")), 15_000);
          timer.unref();
        }),
      ]).finally(() => clearTimeout(timer));
      if (!thumbnail) return; // External catalog images retain their public HTTPS URL.
      const contentId = `product-${product.id}`;
      images[product.id] = `cid:${contentId}`;
      attachments.push({ filename: `${contentId}.jpg`, content: thumbnail.toString("base64"), content_type: "image/jpeg", content_id: contentId });
    } catch {
      logger.warn({ productId: product.id }, "Unable to embed product thumbnail; using the catalog image URL");
    }
  }));
  attachments.sort((a, b) => a.content_id.localeCompare(b.content_id));
  return { images, attachments };
}
