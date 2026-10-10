// Run from the workspace root: node artifacts/api-server/tests/product-image-storage.integration.mjs
// Creates and removes one blank PNG fixture. Never logs signed URLs or storage credentials.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { build } = require("esbuild");
const result = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/productImageStorage.ts", import.meta.url))],
  bundle: true, packages: "external", write: false, platform: "node", format: "cjs",
});
const loaded = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(require, loaded, loaded.exports);
const { createProductImageUpload, productImageIdFromPath, validateProductImageObject, getProductImageFile } = loaded.exports;
const domain = process.env.REPLIT_DEV_DOMAIN;
assert.ok(domain, "A development domain is required for the image-serving check");
const origin = `https://${domain}`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8fkAAAAASUVORK5CYII=", "base64");
let id;
let failed = false;

try {
  await assert.rejects(createProductImageUpload("image/svg+xml"));
  const upload = await createProductImageUpload("image/png");
  id = productImageIdFromPath(upload.objectPath);
  assert.ok(id, "The upload must return a supported image object path");

  const cors = await fetch(upload.uploadURL, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type",
    },
    signal: AbortSignal.timeout(10000),
  });
  assert.ok(cors.ok, `Upload preflight returned HTTP ${cors.status}`);
  assert.ok(["*", origin].includes(cors.headers.get("access-control-allow-origin")), "Uploads must allow the storefront origin");
  assert.ok(cors.headers.get("access-control-allow-methods")?.includes("PUT"), "Uploads must allow PUT");

  const put = await fetch(upload.uploadURL, {
    method: "PUT", headers: { "Content-Type": "image/png" }, body: png,
    signal: AbortSignal.timeout(15000),
  });
  assert.ok(put.ok, `Image upload returned HTTP ${put.status}`);
  assert.equal((await validateProductImageObject(id)).contentType, "image/png");

  // Exercise the same public, path-prefixed URL used by the second storefront.
  const served = await fetch(`${origin}/shop${upload.objectPath}`, {
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  assert.equal(served.status, 200, "An anonymous shopper must be able to load the image");
  assert.equal(served.headers.get("content-type")?.split(";")[0], "image/png");
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), png);
  console.log("PASS: image-type protection, upload signing, browser CORS, PNG upload, stored-file validation and anonymous storefront image serving.");
} catch (error) {
  failed = true;
  // Assertion messages are controlled above; external errors can contain signed URLs.
  console.error(error instanceof assert.AssertionError ? error.message : `Image storage check failed (${error?.name || "unknown error"}).`);
} finally {
  if (id) {
    try {
      await getProductImageFile(id).delete({ ignoreNotFound: true });
      console.log("Cleanup: the temporary image was removed.");
    } catch {
      failed = true;
      console.error("The temporary image could not be removed.");
    }
  }
}
if (failed) process.exitCode = 1;
