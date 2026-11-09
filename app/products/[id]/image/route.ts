import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationSession } from "@/app/lib/auth";
import { getPostgresPool } from "@/app/lib/database";

const maximumImageSize = 2 * 1024 * 1024;
const uuidPattern = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

function matchesImageSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  }
  if (mimeType === "image/gif") {
    return bytes.subarray(0, 6).toString("ascii") === "GIF87a" ||
      bytes.subarray(0, 6).toString("ascii") === "GIF89a";
  }
  return mimeType === "image/webp" &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

async function readBoundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumImageSize + 64_000) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireOrganizationSession();
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return new Response("Not found", { status: 404 });
  const result = await getPostgresPool().query<{ image_data: Buffer; image_mime: string }>(
    `SELECT image_data, image_mime FROM dashboard_products
     WHERE organization_id = $1 AND id = $2 AND image_data IS NOT NULL`,
    [session.organization.id, id],
  );
  const image = result.rows[0];
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(Uint8Array.from(image.image_data), {
    headers: {
      "Content-Type": image.image_mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireOrganizationSession();
  if (session.organization.role === "viewer") {
    return new Response("Forbidden", { status: 403 });
  }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return new Response("Forbidden", { status: 403 });
  }
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return new Response("Not found", { status: 404 });
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumImageSize + 64_000) {
    return new Response("Image exceeds the 2 MB upload limit.", { status: 413 });
  }
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) {
    return new Response("Expected a multipart image upload.", { status: 415 });
  }
  const body = await readBoundedBody(request);
  if (!body) return new Response("Image exceeds the 2 MB upload limit.", { status: 413 });
  let formData: FormData;
  try {
    formData = await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    }).formData();
  } catch {
    return new Response("Invalid multipart image upload.", { status: 400 });
  }
  const file = formData.get("image");
  if (!(file instanceof File) || file.size < 1 || file.size > maximumImageSize) {
    redirect("/products?error=image");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!matchesImageSignature(bytes, file.type)) redirect("/products?error=image");
  const result = await getPostgresPool().query(
    `UPDATE dashboard_products
     SET image_data = $3, image_mime = $4, updated_at = now()
     WHERE organization_id = $1 AND id = $2 AND archived_at IS NULL`,
    [session.organization.id, id, bytes, file.type],
  );
  if (result.rowCount !== 1) redirect("/products?error=product");
  revalidatePath("/products", "page");
  revalidatePath("/");
  redirect("/products?updated=image");
}
