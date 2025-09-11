// src/scripts/sync.cjs
require("dotenv").config({ path: ".env" });

const path = require("path");
const { google } = require("googleapis");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const SHEET_ID = process.env.SHEET_ID;
const SHEET_TAB = "Directory";
const keyFile = path.join(process.cwd(), "credentials", "mmid-service-account.json");

// helpers
const splitCsv = (s) =>
  (s ?? "")
    .toString()
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

// Google Sheets date serial -> JS Date
function serialToDate(n) {
  if (n == null || n === "") return null;
  const epoch = new Date(Date.UTC(1899, 11, 30)); // Sheets epoch
  const ms = Math.round(Number(n) * 24 * 60 * 60 * 1000);
  const d = new Date(epoch.getTime() + ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function readSheet() {
  if (!SHEET_ID) throw new Error("Missing SHEET_ID in .env");

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A1:Z`,
    valueRenderOption: "UNFORMATTED_VALUE", // numbers for dates, etc.
  });

  const values = res.data.values || [];
  if (values.length < 2) return { rows: [], idx: {} };

  const headers = values[0].map((h) => (h || "").toString().trim());
  const rows = values.slice(1);

  // exact header names from your sheet
  const idx = {
    Username: headers.indexOf("Username"),
    Guild: headers.indexOf("Guild"),
    Status: headers.indexOf("Status"),
    UUID: headers.indexOf("UUID"),
    Rank: headers.indexOf("Rank"),
    TypeOfCheating: headers.indexOf("Type of cheating"),
    ReviewedBy: headers.indexOf("Reviewed by"),
    ConfidenceScore: headers.indexOf("Confidence Score"),
    RedFlags: headers.indexOf("Red Flags"),
    NotesEvidence: headers.indexOf("Notes/Evidence"),
    LastUpdated: headers.indexOf("Last Updated"),
    NameMC: headers.indexOf("NameMC Link"),
  };

  return { rows, idx };
}

async function main() {
  const { rows, idx } = await readSheet();
  console.log(`Rows fetched: ${rows.length}`);

  let created = 0, updated = 0, skipped = 0;

  for (const row of rows) {
    const get = (i) => (i >= 0 ? row[i] ?? "" : "");

    const uuid           = (get(idx.UUID) || "").toString().trim();
    const username       = (get(idx.Username) || "").toString().trim();
    const guild          = get(idx.Guild) || null;
    const status         = get(idx.Status) || null;
    const rank           = get(idx.Rank) || null;
    const typeOfCheating = splitCsv(get(idx.TypeOfCheating));
    const reviewedBy     = get(idx.ReviewedBy) || null;

    // Confidence: could be 0–5 numeral or stars "★★★★★"
    let confidenceScore = get(idx.ConfidenceScore);
    if (typeof confidenceScore === "string") {
      const stars = (confidenceScore.match(/★/g) || []).length;
      confidenceScore = stars || parseInt(confidenceScore, 10);
    }
    if (
      confidenceScore !== null &&
      confidenceScore !== "" &&
      !Number.isNaN(Number(confidenceScore))
    ) {
      confidenceScore = Number(confidenceScore);
    } else {
      confidenceScore = null;
    }

    const redFlags       = splitCsv(get(idx.RedFlags));
    const notesEvidence  = get(idx.NotesEvidence) || null;

    const lastUpdatedRaw = get(idx.LastUpdated);
    const lastUpdated =
      typeof lastUpdatedRaw === "number"
        ? serialToDate(lastUpdatedRaw)
        : (lastUpdatedRaw ? new Date(lastUpdatedRaw) : null);

    const nameMcLink     = get(idx.NameMC) || null;

    if (!uuid) { skipped++; continue; } // enforce UUID-only key

    const exists = await prisma.mmidEntry.findUnique({ where: { uuid } });

    await prisma.mmidEntry.upsert({
      where: { uuid },
      create: {
        uuid,
        username,
        guild,
        status,
        rank,
        typeOfCheating,
        reviewedBy,
        confidenceScore,
        redFlags,
        notesEvidence,
        lastUpdated,
        nameMcLink,
      },
      update: {
        username,
        guild,
        status,
        rank,
        typeOfCheating,
        reviewedBy,
        confidenceScore,
        redFlags,
        notesEvidence,
        lastUpdated,
        nameMcLink,
      },
    });

    if (exists) updated++; else created++;
  }

  console.log(`Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
  console.log("✅ Sync complete.");
}

main()
  .catch((e) => { console.error("❌ Sync failed:", e); process.exit(1); })
  .finally(async () => prisma.$disconnect());
