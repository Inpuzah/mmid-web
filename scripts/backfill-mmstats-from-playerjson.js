// scripts/backfill-mmstats-from-playerjson.js
//
// Backfills HypixelPlayerSnapshot.mmStatsJson using the already-stored
// HypixelPlayerSnapshot.playerJson.
//
// This fixes older rows that only stored a handful of MM stats (wins/kills/etc),
// which makes the UI show lots of dashes.
//
// No Hypixel API calls are made.
//
// Usage:
//   node scripts/backfill-mmstats-from-playerjson.js
//   node scripts/backfill-mmstats-from-playerjson.js --dry-run

require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractMmStatsFromPlayer(player) {
  if (!player || typeof player !== "object") return null;
  const mm = (player.stats && player.stats.MurderMystery) || undefined;
  if (!mm || typeof mm !== "object") return null;

  const wins = num(mm.wins || mm.overall_wins);
  const kills = num(mm.kills || mm.overall_kills);
  const deaths = num(mm.deaths || mm.overall_deaths);
  const gamesPlayed = num(mm.games || mm.games_played || mm.total_games);

  const murdererWins = num(mm.murderer_wins || mm.wins_as_murderer);
  const detectiveWins = num(mm.detective_wins || mm.wins_as_detective);
  const heroWins = num(mm.hero_wins);

  const killsAsMurderer = num(mm.kills_as_murderer || mm.murderer_kills || mm.knife_kills);
  const bowKills = num(mm.bow_kills || mm.bow_kills_murderer);
  const thrownKnifeKills = num(mm.thrown_knife_kills);
  const trapKills = num(mm.trap_kills);
  const heroKills = num(mm.hero_kills);

  const bowKillsTotal = num(mm.bow_kills_total || mm.bow_kills);
  const suicides = num(mm.suicides);

  const tokens = num(mm.tokens || mm.coins);
  const goldPickedUp = num(mm.gold_picked_up || mm.gold_picked_up_total || mm.coins_pickedup || mm.coins_picked_up);

  const equippedKnifeSkin = typeof mm.active_knife_skin === "string" ? mm.active_knife_skin : null;

  const networkExp = num(player.networkExp);
  let networkLevel = null;
  if (networkExp != null) {
    const raw = Math.sqrt(2 * networkExp + 30625) / 50 - 2.5;
    networkLevel = Number(raw.toFixed(2));
  }

  const achievementPoints = num(player.achievementPoints);
  const karma = num(player.karma);
  const rewardStreak = num(player.rewardStreak);
  const totalDailyRewards = num(player.totalDailyRewards);
  const totalRewards = num(player.totalRewards);

  let questsCompleted = null;
  const quests = player.quests;
  if (quests && typeof quests === "object") {
    let total = 0;
    for (const key of Object.keys(quests)) {
      const q = quests[key];
      if (q && Array.isArray(q.completions)) total += q.completions.length;
    }
    questsCompleted = total;
  }

  let challengesCompleted = null;
  const challenges = player.challenges;
  if (challenges && typeof challenges === "object" && challenges.all_time) {
    let totalC = 0;
    const allTime = challenges.all_time;
    for (const key of Object.keys(allTime)) {
      const v = Number(allTime[key]);
      if (Number.isFinite(v)) totalC += v;
    }
    challengesCompleted = totalC;
  }

  let giftsSent = null;
  let ranksGifted = null;
  const giftingMeta = player.giftingMeta;
  if (giftingMeta && typeof giftingMeta === "object") {
    giftsSent = num(giftingMeta.giftsGiven);
    ranksGifted = num(giftingMeta.ranksGiven);
  }

  const firstLogin = num(player.firstLogin);
  const lastLogin = num(player.lastLogin);

  const rankPlusColorRaw = player.rankPlusColor || player.monthlyRankColor;
  const rankPlusColor = typeof rankPlusColorRaw === "string" ? rankPlusColorRaw : null;

  const kdr = kills != null && deaths != null && deaths > 0 ? Number((kills / deaths).toFixed(2)) : null;

  return {
    wins,
    kills,
    deaths,
    kdr,
    gamesPlayed,
    murdererWins,
    detectiveWins,
    heroWins,
    killsAsMurderer,
    bowKills,
    thrownKnifeKills,
    trapKills,
    heroKills,
    bowKillsTotal,
    suicides,
    tokens,
    goldPickedUp,
    equippedKnifeSkin,
    networkExp,
    networkLevel,
    achievementPoints,
    karma,
    rewardStreak,
    totalDailyRewards,
    totalRewards,
    questsCompleted,
    challengesCompleted,
    giftsSent,
    ranksGifted,
    firstLogin,
    lastLogin,
    rankPlusColor,
  };
}

function isLegacyShape(mmStatsJson) {
  if (!mmStatsJson || typeof mmStatsJson !== "object") return true;

  // Old rows typically only had ~5 keys.
  const keys = Object.keys(mmStatsJson);
  if (keys.length <= 8) return true;

  // If we don't have any of these, the UI will show lots of dashes.
  if (!("gamesPlayed" in mmStatsJson) || !("deaths" in mmStatsJson) || !("tokens" in mmStatsJson)) {
    return true;
  }

  return false;
}

(async () => {
  const rows = await prisma.hypixelPlayerSnapshot.findMany({
    select: { uuid: true, fetchedAt: true, mmStatsJson: true, playerJson: true },
  });

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let missingPlayerJson = 0;

  for (const r of rows) {
    scanned += 1;

    if (!isLegacyShape(r.mmStatsJson)) {
      skipped += 1;
      continue;
    }

    const player = r.playerJson;
    if (!player || typeof player !== "object" || Object.keys(player).length === 0) {
      missingPlayerJson += 1;
      continue;
    }

    const mmStats = extractMmStatsFromPlayer(player);
    if (!mmStats) {
      missingPlayerJson += 1;
      continue;
    }

    // If the computed stats are still tiny, don't overwrite (likely bad payload).
    if (Object.keys(mmStats).length < 10) {
      missingPlayerJson += 1;
      continue;
    }

    if (DRY_RUN) {
      updated += 1;
      continue;
    }

    await prisma.hypixelPlayerSnapshot.update({
      where: { uuid: r.uuid },
      data: { mmStatsJson: mmStats },
    });

    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: DRY_RUN,
        scanned,
        updated,
        skipped,
        missingPlayerJson,
      },
      null,
      2,
    ),
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
