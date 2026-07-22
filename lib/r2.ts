import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { env } from "./env";

function r2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env("R2_ACCESS_KEY_ID"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    },
  });
}

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

/** Server-generated object key — never trusts a client-supplied path. */
function objectKey(kind: "receipts" | "logos" | "properties", contentType: string) {
  return `${kind}/${randomUUID()}.${contentType.split("/")[1]}`;
}

/**
 * Uploads through the app server rather than the browser talking to R2
 * directly.
 *
 * A presigned PUT is more efficient — the bytes skip this server entirely —
 * but it makes the browser issue a cross-origin request to Cloudflare, which
 * anything between the user and R2 can veto: a missing CORS rule, an ad
 * blocker, a privacy extension, a corporate filter. All of them surface as the
 * same opaque failure with no way for the app to tell them apart, and no fix
 * that lives in this codebase.
 *
 * Going through the server makes the upload same-origin, so none of that
 * applies. The cost is the request body limit on serverless (4.5 MB), which is
 * why the client downscales images before sending.
 */
export async function putObject(
  kind: "receipts" | "logos" | "properties",
  contentType: string,
  body: Buffer
): Promise<string> {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error("Unsupported file type");
  }
  const key = objectKey(kind, contentType);

  await r2Client().send(
    new PutObjectCommand({
      Bucket: env("R2_BUCKET_NAME"),
      Key: key,
      ContentType: contentType,
      Body: body,
    })
  );

  return `${env("R2_PUBLIC_URL").replace(/\/+$/, "")}/${key}`;
}

/**
 * Presigned PUT upload. Retained for callers that can upload directly, but the
 * app's own upload path uses putObject() above — see the note there on why.
 */
export async function createUploadUrl(kind: "receipts" | "logos" | "properties", contentType: string) {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error("Unsupported file type");
  }
  const ext = contentType.split("/")[1];
  const key = `${kind}/${randomUUID()}.${ext}`;

  const uploadUrl = await getSignedUrl(
    r2Client(),
    new PutObjectCommand({ Bucket: env("R2_BUCKET_NAME"), Key: key, ContentType: contentType }),
    { expiresIn: 300 }
  );

  const publicUrl = `${env("R2_PUBLIC_URL").replace(/\/+$/, "")}/${key}`;
  return { uploadUrl, publicUrl };
}
