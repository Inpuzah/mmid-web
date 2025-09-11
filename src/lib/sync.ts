// src/lib/sync.ts
import { PrismaClient } from "@prisma/client";
import { google } from "googleapis";

const prisma = new PrismaClient();

const SHEET_ID = process.env.SHEET_ID!;
const SHEET_TAB = process.env.SHEET_TAB || "Directory";

function splitCsv(s: unknown) {
  return String(s ?? "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
}

// Google Sheets date serial -> JS Date
function serialToDate(n: unknown) {
  if (n == null || n === "") return null;
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const ms = Math.round(num * 24 * 60 * 60 * 1000);
  const d = new Date(epoch.getTime() + ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function runSync() {
  if (!SHEET_ID) throw new Error("Missing SHEET_ID env");

  // Use JSON creds from env (works on Vercel)
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A1:Z`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const values = res.data.values || [];
  if (values.length < 2) return { created: 0, updated: 0, skipped: 0 };

  const headers = values[0].map(h => String(h ?? "").trim());
  const rows = values.slice(1);

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

  let created = 0, updated = 0, skipped = 0;

  for (const row of rows) {
    const get = (i: number) => (i >= 0 ? row[i] ?? "" : "");

    const uuid = String(get(idx.UUID) || "").trim();
    if (!uuid) { skipped++; continue; }

    const username       = String(get(idx.Username) || "").trim();
    const guild          = get(idx.Guild) || null;
    const status         = get(idx.Status) || null;
    const rank           = get(idx.Rank) || null;
    const typeOfCheating = splitCsv(get(idx.TypeOfCheating));
    const reviewedBy     = get(idx.ReviewedBy) || null;

    let confidenceScore: number | null = null;
    let cs = get(idx.ConfidenceScore);
    if (typeof cs === "string") {
      const stars = (cs.match(/★/g) || []).length;
      cs = stars || parseInt(cs, 10);
    }
    if (cs !== null && cs !== "" && Number.isFinite(Number(cs))) {
      confidenceScore = Number(cs);
    }

    const redFlags      = splitCsv(get(idx.RedFlags));
    const notesEvidence = get(idx.NotesEvidence) || null;

    const lastUpdatedRaw = get(idx.LastUpdated);
    const lastUpdated =
      typeof lastUpdatedRaw === "number"
        ? serialToDate(lastUpdatedRaw)
        : (lastUpdatedRaw ? new Date(lastUpdatedRaw as string) : null);

    const nameMcLink = get(idx.NameMC) || null;

    // upsert (no pre-read required)
    const result = await prisma.mmidEntry.upsert({
      where: { uuid },
      create: {
        uuid, username, guild, status, rank,
        typeOfCheating, reviewedBy, confidenceScore,
        redFlags, notesEvidence, lastUpdated, nameMcLink,
      },
      update: {
        username, guild, status, rank,
        typeOfCheating, reviewedBy, confidenceScore,
        redFlags, notesEvidence, lastUpdated, nameMcLink,
      },
      select: { uuid: true }, // shrink payload
    });

    // naive created/updated counter: check if it existed already by trying a find before write if you need exactness; for now:
    // if you really want accurate counts, do a findUnique first.
    updated++; // treat all as updated; or implement pre-check
  }

  return { created, updated, skipped };
}
