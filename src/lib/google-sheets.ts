// src/lib/google-sheets.ts
import { google } from "googleapis";

type RawRow = Record<string, string | undefined>;
export type DirectoryRow = {
  uuid: string;
  username: string;
  guild?: string;
  status?: string;
  rank?: string;
  typeOfCheating: string[]; // split by comma
  reviewedBy?: string;
  confidenceScore?: number;
  redFlags: string[];       // split by comma
  notesEvidence?: string;
  lastUpdated?: Date;
  nameMcLink?: string;
};

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

function getServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON");
  const svc = JSON.parse(raw);
  // Fix escaped newlines in private key
  svc.private_key = (svc.private_key as string).replace(/\\n/g, "\n");
  return svc as {
    client_email: string;
    private_key: string;
  };
}

async function getSheets() {
  const svc = getServiceAccount();
  const auth = new google.auth.JWT({
    email: svc.client_email,
    // normalize private key newlines if coming from env
    key: (svc.private_key || "").replace(/\\n/g, "\n"),
    scopes: SCOPES,
  });
  return google.sheets({ version: "v4", auth });
}

/** Reads the 'Directory' tab as an array of objects keyed by header row */
export async function readDirectorySheet(sheetId = process.env.SHEET_ID!, tab = process.env.SHEET_TAB ?? "Directory") {
  if (!sheetId) throw new Error("Missing SHEET_ID");
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tab}!A1:Z`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = res.data.values ?? [];
  if (values.length < 2) return [];

  const headers = values[0].map((h: any) => String(h).trim());
  const rows = values.slice(1);

  const asObjects: RawRow[] = rows.map((row) => {
    const obj: RawRow = {};
    headers.forEach((h, i) => (obj[h] = row[i] !== undefined ? String(row[i]) : undefined));
    return obj;
  });

  return asObjects;
}

/** Map sheet headers to your Prisma fields */
export function mapRowToEntry(r: RawRow): DirectoryRow | null {
  // Expecting sheet headers exactly like these:
  // "UUID","Username","Guild","Status","Rank","Type of cheating","Reviewed by","Confidence Score","Red Flags","Notes/Evidence","Last Updated","NameMC Link"
  const uuid = (r["UUID"] ?? "").trim();
  const username = (r["Username"] ?? "").trim();
  if (!uuid || !username) return null;

  const splitList = (s?: string) =>
    (s ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  const parseDate = (s?: string) => {
    if (!s) return undefined;
    const d = new Date(s);
    return isNaN(d.getTime()) ? undefined : d;
  };

  const confidence = r["Confidence Score"] ? Number(r["Confidence Score"]) : undefined;

  return {
    uuid,
    username,
    guild: r["Guild"]?.trim() || undefined,
    status: r["Status"]?.trim() || undefined,
    rank: r["Rank"]?.trim() || undefined,
    typeOfCheating: splitList(r["Type of cheating"]),
    reviewedBy: r["Reviewed by"]?.trim() || undefined,
    confidenceScore: Number.isFinite(confidence) ? confidence : undefined,
    redFlags: splitList(r["Red Flags"]),
    notesEvidence: r["Notes/Evidence"]?.trim() || undefined,
    lastUpdated: parseDate(r["Last Updated"]),
    nameMcLink: r["NameMC Link"]?.trim() || undefined,
  };
}
