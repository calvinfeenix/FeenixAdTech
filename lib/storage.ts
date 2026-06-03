/** Storage bucket names (must match the buckets created in Supabase). */
export const ASSET_BUCKET = "assets";
export const THUMB_BUCKET = "thumbnails";

/**
 * Build a public URL for an object in a public Supabase Storage bucket.
 * Public buckets serve at /storage/v1/object/public/<bucket>/<path>.
 */
export function publicUrl(bucket: string, path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
