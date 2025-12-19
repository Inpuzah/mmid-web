// scripts/find-snapshot-by-stats.js
// Usage: node scripts/find-snapshot-by-stats.js <wins> <kills>

require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const winsTarget = Number(process.argv[2]);
const killsTarget = Number(process.argv[3]);

(async () => {
  if (!Number.isFinite(winsTarget) || !Number.isFinite(killsTarget)) {
    console.error("Usage: node scripts/find-snapshot-by-stats.js <wins> <kills>");
    process.exitCode = 2;
    return;
  }

  // Pull only the JSON stats and filter in JS (simple + portable).
  const rows = await prisma.hypixelPlayerSnapshot.findMany({
    select: { uuid: true, fetchedAt: true, mmStatsJson: true },
  });

  const matches = [];
  for (const r of rows) {
    const s = r.mmStatsJson;
    if (!s) continue;
    if (Number(s.wins) === winsTarget && Number(s.kills) === killsTarget) {
      matches.push({ uuid: r.uuid, fetchedAt: r.fetchedAt, mmStatsJson: s });
    }
  }

  console.log(JSON.stringify({ count: matches.length, matches: matches.slice(0, 20) }, null, 2));
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
