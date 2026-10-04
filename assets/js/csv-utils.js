const REQUIRED = ["id", "fit", "intent", "engagement", "urgency"];

const normaliseHeader = (value) =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");

const parseNumber = (value) => {
  const numeric = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(numeric) ? numeric : NaN;
};

function splitLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  if (quoted) throw new Error("Comillas sin cerrar en CSV.");
  cells.push(current);
  return cells;
}

export function parseCsv(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) throw new Error("El CSV necesita cabecera y al menos un registro.");

  const headers = splitLine(lines[0]).map(normaliseHeader);
  const missing = REQUIRED.filter((key) => !headers.includes(key));
  if (missing.length) throw new Error("Faltan columnas: " + missing.join(", "));

  return lines.slice(1).map((line, rowIndex) => {
    const cells = splitLine(line);
    const raw = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    return {
      id: String(raw.id).trim() || "ROW-" + (rowIndex + 2),
      account: String(raw.account || raw.company || raw.account_name || "Imported").trim(),
      fit: parseNumber(raw.fit),
      intent: parseNumber(raw.intent),
      engagement: parseNumber(raw.engagement),
      urgency: parseNumber(raw.urgency)
    };
  });
}
