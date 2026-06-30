/**
 * Fetch Roblox game icons by place id (public thumbnails API, no auth).
 * Server-only; results are cached for an hour via the Next fetch cache so we
 * never hammer Roblox. Returns placeId → icon URL (missing ids are skipped).
 */
export async function fetchGameIcons(placeIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = [...new Set(placeIds.filter((p): p is string => !!p))].slice(0, 12);
  if (ids.length === 0) return map;
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${ids.join(",")}&size=150x150&format=Png&isCircular=false`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return map;
    const json = (await res.json()) as { data?: { targetId: number; state: string; imageUrl?: string }[] };
    for (const d of json.data ?? []) {
      if (d.state === "Completed" && d.imageUrl) map.set(String(d.targetId), d.imageUrl);
    }
  } catch {
    /* best-effort — placeholder tiles render if this fails */
  }
  return map;
}
