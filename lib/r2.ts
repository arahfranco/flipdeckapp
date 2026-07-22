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

/**
 * Presigned PUT upload — the browser uploads directly to R2, the app server
 * never sees the file bytes. Object key is server-generated (never trusts a
 * client-supplied path) to avoid path traversal / overwrite of unrelated keys.
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
