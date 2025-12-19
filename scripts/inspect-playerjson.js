// scripts/inspect-playerjson.js
// Usage: node scripts/inspect-playerjson.js <uuidNoDash>

require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const uuid = String(process.argv[2] || "").trim().replace(/-/g, "").toLowerCase();

function get(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

(async () => {
  if (!uuid) {
    console.error("Usage: node scripts/inspect-playerjson.js <uuidNoDash>");
    process.exitCode = 2;
    return;
  }

  const row = await prisma.hypixelPlayerSnapshot.findUnique({
    where: { uuid },
    select: { uuid: true, fetchedAt: true, mmStatsJson: true, playerJson: true },
  });

  if (!row) {
    console.error("No snapshot row found for uuid", uuid);
    process.exitCode = 1;
    return;
  }

  const mm = get(row.playerJson, "stats.MurderMystery") || null;

  const out = {
    uuid: row.uuid,
    fetchedAt: row.fetchedAt,
    mmStatsJsonKeys: row.mmStatsJson ? Object.keys(row.mmStatsJson) : null,
    murderMysteryKeys: mm ? Object.keys(mm).slice(0, 60) : null,
    sample: {
      mm_wins: mm?.wins ?? mm?.overall_wins ?? null,
      mm_kills: mm?.kills ?? mm?.overall_kills ?? null,
      mm_deaths: mm?.deaths ?? mm?.overall_deaths ?? null,
      mm_games: mm?.games ?? mm?.games_played ?? mm?.total_games ?? null,
      mm_tokens: mm?.tokens ?? mm?.coins ?? null,
      mm_gold_picked_up: mm?.gold_picked_up ?? mm?.gold_picked_up_total ?? null,
      mm_suicides: mm?.suicides ?? null,
      mm_thrown_knife_kills: mm?.thrown_knife_kills ?? null,
    },
    hasQuestsObject: row.playerJson && typeof row.playerJson.quests === "object",
    hasChallengesAllTime: Boolean(row.playerJson?.challenges?.all_time),
    giftingMeta: row.playerJson?.giftingMeta ? Object.keys(row.playerJson.giftingMeta) : null,
  };

  console.log(JSON.stringify(out, null, 2));
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
