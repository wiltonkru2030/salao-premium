/**
 * Auditoria estática de organização e documentação do SALÃO PREMIUM.
 *
 * O script não modifica arquivos. Ele verifica cabeçalhos de módulos, documentação
 * JSDoc de funções exportadas, tamanho de arquivos e linhas excessivamente longas.
 * Os apontamentos são relatórios de trabalho: não são corrigidos automaticamente,
 * pois comentários gerados sem compreender a regra de negócio podem induzir ao erro.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["src", "cliente", "professional", "scripts", "tests", "docs/sql", "supabase/functions"];
const ignored = new Set(["node_modules", "dist", "build", ".git"]);
const files = [];

async function walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath);
    else if (entry.isFile() && /\.(js|mjs|css|ts)$/.test(entry.name)) files.push(fullPath);
  }
}

/** Confere se a declaração exportada é precedida por um bloco JSDoc. */
function hasJsDocBefore(lines, index) {
  let cursor=index-1;
  while(cursor>=0&&!lines[cursor].trim())cursor--;
  if(cursor<0||!lines[cursor].trim().endsWith("*/"))return false;
  // Para no início do comentário imediatamente anterior, sem atravessar código.
  while(cursor>=0){
    const line=lines[cursor].trim();
    if(line.startsWith("/**"))return true;
    if(line.startsWith("/*")||(!line.startsWith("*")&&cursor!==index-1))return false;
    cursor--;
  }
  return false;
}

for (const root of roots) await walk(root);
files.sort();

const findings = [];
let documentedExports = 0;
let undocumentedExports = 0;
let jsFiles = 0;

for (const file of files) {
  const content = await readFile(file, "utf8");
  const lines = content.split(/\r?\n/);
  const maxLine = Math.max(0, ...lines.map(line => line.length));
  const firstCode = lines.find(line => line.trim())?.trim() || "";

  if (/\.(js|mjs|ts)$/.test(file)) {
    jsFiles += 1;
    if (!firstCode.startsWith("/*") && !firstCode.startsWith("//")) {
      findings.push({ file, kind: "sem descrição inicial do módulo" });
    }
    lines.forEach((line, index) => {
      if (!/^\s*export\s+(?:default\s+)?(?:async\s+)?function\s+[A-Za-z_$][\w$]*/.test(line) &&
          !/^\s*export\s+(?:const|let)\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/.test(line)) return;
      if (hasJsDocBefore(lines, index)) documentedExports += 1;
      else {
        undocumentedExports += 1;
        findings.push({ file, line: index + 1, kind: "função exportada sem JSDoc" });
      }
    });
  }

  if (lines.length > 300) findings.push({ file, kind: "arquivo acima de 300 linhas", value: lines.length });
  if (maxLine > 400) findings.push({ file, kind: "linha acima de 400 caracteres", value: maxLine });
}

console.log("Auditoria de estrutura e documentação do SALÃO PREMIUM");
console.log("Arquivos verificados:", files.length, "| Arquivos JS/MJS:", jsFiles);
console.log("Funções exportadas com JSDoc:", documentedExports);
console.log("Funções exportadas sem JSDoc:", undocumentedExports);
if (!findings.length) console.log("Nenhuma pendência detectada pelos critérios estáticos.");
else {
  for (const item of findings) {
    const location = item.line ? ":" + item.line : "";
    const value = item.value ? ": " + item.value : "";
    console.log("- " + item.file + location + " | " + item.kind + value);
  }
  console.log("Total de apontamentos:", findings.length);
}
