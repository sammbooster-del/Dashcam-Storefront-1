import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getProductImageFile, productImageIdFromPath } from "./productImageStorage";
import { logger } from "./logger";

export type InlineEmailImage = { filename: string; content: string; content_type: string; content_id: string };

export async function prepareVisaEmailLogo(): Promise<InlineEmailImage> {
  // Same Visa artwork already used by the storefront. Rasterize for email clients
  // that do not support SVG, and embed it so no remote image request is required.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 8 24 8" width="156" height="52"><path fill="#1A1F71" d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z"/></svg>`;
  const png = await sharp(Buffer.from(svg)).resize(156, 52).png().toBuffer();
  return { filename: "visa.png", content: png.toString("base64"), content_type: "image/png", content_id: "payment-visa" };
}

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
