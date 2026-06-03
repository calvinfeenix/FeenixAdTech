import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { ASSET_BUCKET, THUMB_BUCKET } from "@/lib/storage";
import { assetTypeFromMime } from "@/lib/utils";

// sharp is a native module → force the Node.js runtime (not Edge).
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB ceiling

/**
 * Admin-only asset upload.
 *  - images: re-encoded to WebP (max 1600px) + a 400px thumbnail, both via sharp
 *  - video/audio: stored as-is; an optional client-captured poster frame becomes
 *    the thumbnail, and the client-measured duration is recorded
 * Storage writes use the service role (buckets are public-read, server-write);
 * the DB row is inserted under the admin's RLS context.
 */
export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "admin" || profile.status !== "approved") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 100 MB limit" }, { status: 413 });
  }

  const type = assetTypeFromMime(file.type);
  if (!type) {
    return NextResponse.json(
      { error: "Unsupported file type. Use an image, video, or audio file." },
      { status: 415 }
    );
  }

  const title = String(form.get("title") ?? "").trim() || file.name;
  const tags = String(form.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const id = crypto.randomUUID();
  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  let storagePath: string;
  let thumbPath: string | null = null;
  let mime = file.type;
  let width: number | null = null;
  let height: number | null = null;
  let optimizedSize: number | null = null;
  let duration: number | null = null;

  try {
    if (type === "image") {
      const pipeline = sharp(buffer, { failOn: "none" }).rotate();
      const meta = await pipeline.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;

      const optimized = await pipeline
        .clone()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const thumb = await pipeline
        .clone()
        .resize({ width: 400, height: 400, fit: "cover" })
        .webp({ quality: 70 })
        .toBuffer();

      mime = "image/webp";
      optimizedSize = optimized.length;
      storagePath = `image/${id}.webp`;
      thumbPath = `image/${id}.webp`;

      const up = await admin.storage
        .from(ASSET_BUCKET)
        .upload(storagePath, optimized, { contentType: mime, upsert: false });
      if (up.error) throw up.error;
      const upThumb = await admin.storage
        .from(THUMB_BUCKET)
        .upload(thumbPath, thumb, { contentType: mime, upsert: false });
      if (upThumb.error) throw upThumb.error;
    } else {
      // video / audio: store the original untouched.
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      storagePath = `${type}/${id}.${ext}`;
      const up = await admin.storage
        .from(ASSET_BUCKET)
        .upload(storagePath, buffer, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;

      const durationRaw = form.get("duration");
      if (durationRaw) duration = Number(durationRaw) || null;

      // Optional poster frame (captured client-side for video).
      const poster = form.get("poster");
      if (poster instanceof File && poster.size > 0) {
        const posterBuf = Buffer.from(await poster.arrayBuffer());
        const thumb = await sharp(posterBuf, { failOn: "none" })
          .resize({ width: 400, height: 400, fit: "cover" })
          .webp({ quality: 70 })
          .toBuffer();
        thumbPath = `${type}/${id}.webp`;
        const upThumb = await admin.storage
          .from(THUMB_BUCKET)
          .upload(thumbPath, thumb, { contentType: "image/webp", upsert: false });
        if (upThumb.error) throw upThumb.error;
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Processing/upload failed: ${String((err as Error).message ?? err)}` },
      { status: 500 }
    );
  }

  // Insert the metadata row under the admin's own RLS context.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .insert({
      id,
      uploaded_by: profile.id,
      type,
      title,
      original_filename: file.name,
      storage_path: storagePath,
      thumb_path: thumbPath,
      mime,
      size_bytes: file.size,
      optimized_size_bytes: optimizedSize,
      width,
      height,
      duration_seconds: duration,
      tags,
    })
    .select()
    .single();

  if (error) {
    // Roll back the orphaned storage objects on a DB failure.
    await admin.storage.from(ASSET_BUCKET).remove([storagePath]);
    if (thumbPath) await admin.storage.from(THUMB_BUCKET).remove([thumbPath]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ asset: data });
}
