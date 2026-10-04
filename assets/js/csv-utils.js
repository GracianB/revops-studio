const REQUIRED = ["id", "fit", "intent", "engagement", "urgency"];
const MAX_ROWS = 5000;
const MAX_CHARS = 2_000_000;
const SUPPORTED_DELIMITERS = [",", ";"];

const normaliseHeader = (value) =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");

const parseNumber = (value) => {
  const numeric = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(numeric) ? numeric : NaN;
};

function detectDelimiter(headerLine) {
  const counts = SUPPORTED_DELIMITERS.map((delimiter) => ({
    delimiter,
    count: [...headerLine].filter((char) => char === delimiter).length
  }));
  return counts.sort((a, b) => b.count - a.count)[0].delimiter;
}

function parseRows(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => String(value).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  if (quoted) throw new Error("Comillas sin cerrar en CSV.");
  row.push(cell);
  if (row.some((value) => String(value).trim() !== "")) rows.push(row);
  return rows;
}

export function parseCsv(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  if (!source.trim()) throw new Error("El CSV está vacío.");
  if (source.length > MAX_CHARS) throw new Error("CSV demasiado grande: máximo 2 MB.");

  const firstLine = source.split(/\r?\n/, 1)[0];
  const delimiter = detectDelimiter(firstLine);
  const rows = parseRows(source, delimiter);

  if (rows.length < 2) throw new Error("El CSV necesita cabecera y al menos un registro.");
  if (rows.length - 1 > MAX_ROWS) throw new Error("Demasiadas filas: máximo " + MAX_ROWS + ".");

  const headers = rows[0].map(normaliseHeader);
  const duplicates = headers.filter((header, index) => header && headers.indexOf(header) !== index);
  if (duplicates.length) throw new Error("Columnas duplicadas: " + [...new Set(duplicates)].join(", "));

  const missing = REQUIRED.filter((key) => !headers.includes(key));
  if (missing.length) throw new Error("Faltan columnas: " + missing.join(", "));

  return rows.slice(1).map((cells, rowIndex) => {
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
