// Small dependency-free CSV parser (RFC4180-ish: handles quoted fields,
// embedded commas, embedded newlines, and "" as an escaped quote).
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

// Normalize line endings and strip a UTF-8 BOM if present.
const input = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).replace(/\r\n/g, "\n");

for (let i = 0; i < input.length; i++) {
  const char = input[i];

  if (inQuotes) {
    if (char === '"') {
      if (input[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else {
      field += char;
    }
    continue;
  }

  if (char === '"') {
    inQuotes = true;
  } else if (char === ",") {
    row.push(field);
    field = "";
  } else if (char === "\n") {
    row.push(field);
    rows.push(row);
    row = [];
    field = "";
  } else {
    field += char;
  }
}

// Flush the last field/row if the file doesn't end with a newline.
if (field.length > 0 || row.length > 0) {
  row.push(field);
  rows.push(row);
}

// Drop fully blank trailing rows (common with a trailing newline).
return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

const HEADER_ALIASES: Record<string, string[]> = {
  company_name: ["company", "companyname", "clinic", "clinicname", "business", "businessname", "name"],
  contact_name: ["contact", "contactname", "decisionmaker"],
  contact_role: ["role", "contactrole", "title", "jobtitle"],
  phone: ["phone", "phonenumber", "tel", "telephone", "mobile"],
  email: ["email", "emailaddress"],
  website: ["website", "url", "site"],
  region: ["region", "location", "city", "area"],
  tier: ["tier"],
  source: ["source", "leadsource"],
  google_rating: ["googlerating", "rating"],
  google_reviews: ["googlereviews", "reviews", "reviewcount"],
  signals: ["signals"],
  research_notes: ["notes", "researchnotes", "research"],
};

export type ParsedLeadRow = {
  line: number; // 1-based, counting the header as line 1
  company_name: string;
  contact_name: string | null;
  contact_role: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  region: string | null;
  tier: "T1" | "T2" | "T3";
  tier_label: string;
  source: string | null;
  google_rating: number | null;
  google_reviews: number | null;
  signals: string | null;
  research_notes: string | null;
};

export type CsvImportResult = {
  rows: ParsedLeadRow[];
  skipped: { line: number; reason: string }[];
};

const TIER_LABELS: Record<"T1" | "T2" | "T3", string> = {
  T1: "Whale",
  T2: "Bread & Butter",
  T3: "Mass Market",
};

function parseTier(raw: string | undefined): "T1" | "T2" | "T3" {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "t1" || v === "1" || v.includes("whale")) return "T1";
  if (v === "t3" || v === "3" || v.includes("mass")) return "T3";
  if (v === "t2" || v === "2" || v.includes("bread")) return "T2";
  return "T2";
}

export function parseLeadsCsv(text: string): CsvImportResult {
  const table = parseCsv(text);
  const rows: ParsedLeadRow[] = [];
  const skipped: CsvImportResult["skipped"] = [];

if (table.length === 0) return { rows, skipped };

const headerRow = table[0].map(normalizeHeader);
  const columnIndex: Partial<Record<string, number>> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = headerRow.findIndex((h) => h === field || aliases.includes(h));
    if (idx !== -1) columnIndex[field] = idx;
  }

function cell(row: string[], field: string): string | undefined {
  const idx = columnIndex[field];
  if (idx === undefined) return undefined;
  return row[idx]?.trim();
}

for (let i = 1; i < table.length; i++) {
  const raw = table[i];
  const line = i + 1;
  const companyName = cell(raw, "company_name");

  if (!companyName) {
    skipped.push({ line, reason: "missing company name" });
    continue;
  }

  const tier = parseTier(cell(raw, "tier"));
  const ratingRaw = cell(raw, "google_rating");
  const reviewsRaw = cell(raw, "google_reviews");

  rows.push({
    line,
    company_name: companyName,
    contact_name: cell(raw, "contact_name") || null,
    contact_role: cell(raw, "contact_role") || null,
    phone: cell(raw, "phone") || null,
    email: cell(raw, "email") || null,
    website: cell(raw, "website") || null,
    region: cell(raw, "region") || null,
    tier,
    tier_label: TIER_LABELS[tier],
    source: cell(raw, "source") || null,
    google_rating: ratingRaw && !isNaN(Number(ratingRaw)) ? Number(ratingRaw) : null,
    google_reviews: reviewsRaw && !isNaN(Number(reviewsRaw)) ? Number(reviewsRaw) : null,
    signals: cell(raw, "signals") || null,
    research_notes: cell(raw, "research_notes") || null,
  });
}

return { rows, skipped };
}

export const CSV_TEMPLATE = `company_name,contact_name,contact_role,phone,email,website,region,tier,source,notes
Glow Aesthetics,Sarah Jones,Practice Manager,020 7946 0000,sarah@glowaesthetics.co.uk,glowaesthetics.co.uk,"Manchester, UK",T2,Cold call,Found via Google Maps
`;
