/**
 * Seed script — run with `npm run seed` after applying schema.sql and creating
 * the storage buckets. Idempotent: it re-uses existing auth users and fully
 * rebuilds the demo domain data (games, campaigns, analytics) on each run.
 *
 * Requires SUPABASE_SECRET_KEY (the secret API key) in .env.local.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || "feenixgroup0214";

if (!URL || !SECRET_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const db = createClient(URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Create the auth user if absent (idempotent), returning its id. */
async function ensureUser(
  email: string,
  password: string,
  username: string,
  fullName: string
): Promise<string> {
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) return existing.id;

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName },
  });
  if (error || !data.user) throw new Error(`createUser(${email}): ${error?.message}`);
  return data.user.id;
}

async function setProfile(
  id: string,
  fields: {
    email: string;
    username: string;
    full_name: string;
    role: "user" | "admin";
    status: "pending" | "approved" | "rejected";
  }
) {
  // Upsert (don't rely on the handle_new_user trigger) so the seed is
  // deterministic even if the profile row doesn't exist yet.
  const { error } = await db.from("profiles").upsert({ id, ...fields }, { onConflict: "id" });
  if (error) throw new Error(`profile upsert (${fields.username}): ${error.message}`);
}

/** Create the public storage buckets the app needs (idempotent). */
async function ensureBuckets() {
  for (const id of ["assets", "thumbnails"]) {
    const { error } = await db.storage.createBucket(id, { public: true });
    if (error && !/already exists/i.test(error.message)) {
      console.warn(`  ! bucket "${id}": ${error.message}`);
    } else {
      console.log(`  ✓ Bucket ${id} (public)`);
    }
  }
}

async function main() {
  console.log("→ Seeding Feenix AdTech…");

  // ── Storage buckets ──────────────────────────────────────────────────
  await ensureBuckets();

  // ── Users ────────────────────────────────────────────────────────────
  const adminId = await ensureUser(
    "feenix-admin@feenixadtech.app",
    ADMIN_PASSWORD,
    "FEENIX",
    "Feenix Admin"
  );
  await setProfile(adminId, {
    email: "feenix-admin@feenixadtech.app",
    username: "FEENIX",
    full_name: "Feenix Admin",
    role: "admin",
    status: "approved",
  });
  console.log(`  ✓ Admin  FEENIX  (password: ${ADMIN_PASSWORD})`);

  const demoUsers = [
    { email: "maya@brandco.example", username: "maya", full: "Maya Patel", status: "approved" as const },
    { email: "leo@brandco.example", username: "leo", full: "Leo Martins", status: "approved" as const },
    { email: "newbie@brandco.example", username: "newbie", full: "Sam Pending", status: "pending" as const },
  ];
  const userIds: Record<string, string> = {};
  for (const u of demoUsers) {
    const id = await ensureUser(u.email, "password123", u.username, u.full);
    await setProfile(id, {
      email: u.email,
      username: u.username,
      full_name: u.full,
      role: "user",
      status: u.status,
    });
    userIds[u.username] = id;
    console.log(`  ✓ User   ${u.username} (${u.status})`);
  }

  // ── Reset domain data (cascades clear analytics & join tables) ─────────
  await db.from("campaigns").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("games").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // ── Games + locations ──────────────────────────────────────────────────
  const gameSeed = [
    { name: "Tower Defense Simulator", place: "3260590327", locs: ["Lobby Billboard", "Shop Wall", "Spawn Banner"] },
    { name: "Speed Run Legends", place: "286090429", locs: ["Start Gate", "Checkpoint Screen", "Leaderboard"] },
    { name: "Pet Tycoon World", place: "920587237", locs: ["Hatchery Wall", "Trading Plaza", "Main Menu"] },
  ];
  const games: { id: string; name: string; locations: { id: string; name: string }[] }[] = [];
  for (const g of gameSeed) {
    const { data: game } = await db
      .from("games")
      .insert({ name: g.name, roblox_place_id: g.place, status: "active", description: `Ad inventory for ${g.name}.` })
      .select("id, name")
      .single();
    if (!game) continue;
    const { data: locs } = await db
      .from("game_locations")
      .insert(g.locs.map((name) => ({ game_id: game.id, name })))
      .select("id, name");
    games.push({ id: game.id, name: game.name, locations: locs ?? [] });
  }
  console.log(`  ✓ ${games.length} games seeded`);

  // ── Campaigns ───────────────────────────────────────────────────────────
  const campaignSeed = [
    { name: "Summer Sneaker Drop", status: "active" as const, viewers: ["maya", "leo"], games: [0, 1] },
    { name: "Energy Drink Launch", status: "active" as const, viewers: ["maya"], games: [1, 2] },
    { name: "Holiday Teaser", status: "draft" as const, viewers: ["leo"], games: [0] },
  ];

  for (const cs of campaignSeed) {
    const { data: campaign } = await db
      .from("campaigns")
      .insert({
        name: cs.name,
        status: cs.status,
        flight_start: "2026-05-20",
        flight_end: "2026-07-20",
        created_by: adminId,
      })
      .select("id")
      .single();
    if (!campaign) continue;

    await db
      .from("campaign_users")
      .insert(cs.viewers.map((v) => ({ campaign_id: campaign.id, user_id: userIds[v] })));

    const targetGames = cs.games.map((i) => games[i]).filter(Boolean);
    await db
      .from("campaign_games")
      .insert(targetGames.map((g) => ({ campaign_id: campaign.id, game_id: g.id })));
    await db.from("campaign_locations").insert(
      targetGames.flatMap((g) =>
        g.locations.map((l) => ({ campaign_id: campaign.id, game_location_id: l.id }))
      )
    );

    // Realistic analytics for active campaigns over the last 14 days.
    if (cs.status === "active") {
      const rows: {
        campaign_id: string;
        game_id: string;
        location_id: string;
        event_type: "impression" | "click" | "unique_user";
        count: number;
        ts: string;
      }[] = [];
      for (let d = 13; d >= 0; d--) {
        const day = new Date();
        day.setUTCDate(day.getUTCDate() - d);
        const ts = day.toISOString();
        for (const g of targetGames) {
          for (const loc of g.locations) {
            const impressions = 400 + Math.floor(Math.random() * 1600);
            const uniqueUsers = Math.floor(impressions * (0.45 + Math.random() * 0.2));
            const clicks = Math.floor(impressions * (0.008 + Math.random() * 0.02));
            rows.push({ campaign_id: campaign.id, game_id: g.id, location_id: loc.id, event_type: "impression", count: impressions, ts });
            rows.push({ campaign_id: campaign.id, game_id: g.id, location_id: loc.id, event_type: "unique_user", count: uniqueUsers, ts });
            rows.push({ campaign_id: campaign.id, game_id: g.id, location_id: loc.id, event_type: "click", count: clicks, ts });
          }
        }
      }
      await db.from("analytics_events").insert(rows);
    }
    console.log(`  ✓ Campaign "${cs.name}" (${cs.status})`);
  }

  console.log("✅ Seed complete.\n");
  console.log("   Sign in at /login as:");
  console.log(`     FEENIX / ${ADMIN_PASSWORD}   (admin)`);
  console.log("     maya / password123          (approved user)");
  console.log("     newbie / password123        (pending — approve from the Users tab)");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
