import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "index.html",
  "gracias.html",
  "README.md",
  "assets/css/main.css",
  "assets/js/app.js",
  "assets/js/thanks.js",
  "assets/js/revops-engine.js",
  "tests/revops-engine.test.js"
];

const fail = (message) => {
  console.error("VALIDATION FAIL:", message);
  process.exit(1);
};

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) fail("missing " + file);
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) fail("duplicate ids: " + [...new Set(duplicates)].join(", "));

const localRefs = [...html.matchAll(/(?:href|src)="(\.{0,2}\/[^"]+)"/g)]
  .map((match) => match[1].split("#")[0].split("?")[0])
  .filter(Boolean);

for (const ref of localRefs) {
  if (!fs.existsSync(path.normalize(path.join(root, ref)))) fail("broken local reference: " + ref);
}

if (/href="javascript:/i.test(html)) fail("javascript: URL found");

const blankUnsafe = [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)]
  .some((match) => !/rel="[^"]*noopener/i.test(match[0]));
if (blankUnsafe) fail('target="_blank" without noopener');

const secretPatterns = [
  /ghp_[A-Za-z0-9_]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /AIza[0-9A-Za-z_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY/,
  /Bearer [A-Za-z0-9._-]{20,}/i
];

const sourceFiles = [
  "index.html","gracias.html","assets/css/main.css","assets/js/app.js",
  "assets/js/thanks.js","assets/js/revops-engine.js","README.md"
];

for (const file of sourceFiles) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  for (const pattern of secretPatterns) if (pattern.test(content)) fail("credential pattern in " + file);
}

console.log("Validation PASS");
console.log("Unique IDs:", new Set(ids).size);
console.log("Local refs:", localRefs.length);
