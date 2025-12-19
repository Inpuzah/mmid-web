// scripts/debug-hypixel-snapshots.js

require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.hypixelPlayerSnapshot.findMany({
    take: 10,
    orderBy: { fetchedAt: "desc" },
    select: { uuid: true, fetchedAt: true, mmStatsJson: true },
  });

  for (const r of rows) {
    const s = r.mmStatsJson || {};
    const keys = Object.keys(s);
    const sample = {
      wins: s.wins,
      kills: s.kills,
      deaths: s.deaths,
      gamesPlayed: s.gamesPlayed,
      tokens: s.tokens,
      questsCompleted: s.questsCompleted,
      challengesCompleted: s.challengesCompleted,
      giftsSent: s.giftsSent,
      ranksGifted: s.ranksGifted,
    };

    console.log(
      JSON.stringify({
        uuid: r.uuid,
        fetchedAt: r.fetchedAt,
        keyCount: keys.length,
        sample,
      }),
    );
  }
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
