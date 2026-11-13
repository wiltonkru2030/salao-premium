/**
 * Auditoria estática de organização do código.
 * Não altera arquivos: identifica módulos grandes, linhas excessivas e ausência de cabeçalho descritivo.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["src", "professional"];
const ignored = new Set(["node_modules", "dist", "build", ".git"]);
const files = [];

async function walk(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath);
    else if (entry.isFile() && /\.(js|css|d\.ts)$/.test(entry.name)) files.push(fullPath);
  }
}

for (const root of roots) await walk(root);

const findings = [];
for (const file of files) {
  const content = await readFile(file, "utf8");
  const lines = content.split(/\r?\n/);
  const maxLine = Math.max(0, ...lines.map(line => line.length));
  const firstCode = lines.find(line => line.trim())?.trim() || "";
  if (file.endsWith(".js") && !firstCode.startsWith("/**") && !firstCode.startsWith("//")) {
    findings.push({ file, kind: "sem descrição inicial", value: 0 });
  }
  if (lines.length > 300) findings.push({ file, kind: "arquivo acima de 300 linhas", value: lines.length });
  if (maxLine > 400) findings.push({ file, kind: "linha acima de 400 caracteres", value: maxLine });
}

console.log("Auditoria de estrutura do SALÃO PREMIUM");
console.log("Arquivos verificados:", files.length);
if (!findings.length) console.log("Nenhuma pendência estrutural encontrada.");
else {
  for (const item of findings) console.log("- " + item.file + " | " + item.kind + (item.value ? ": " + item.value : ""));
  console.log("Total de apontamentos:", findings.length);
}
