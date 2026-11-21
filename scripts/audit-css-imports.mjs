/**
 * Auditoria de CSS — SALÃO PREMIUM.
 * Responsabilidade: impedir deploy com folhas de estilo ausentes ou imports inválidos.
 * Verifica os três pontos de entrada: painel, cliente e profissional.
 * Não realiza requisições nem altera arquivos.
 */
import {readFile,access} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const entries=["styles.css","cliente/styles.css","professional/styles.css"];
const visited=new Set();
let count=0;

/**
 * Confere imports CSS locais e sua ordem antes das regras comuns.
 * @param {string} file Caminho absoluto da folha de estilo.
 * @returns {Promise<void>} Lança erro com a localização do problema.
 */
async function inspect(file){
 if(visited.has(file))return;
 visited.add(file);
 const source=await readFile(file,"utf8");
 // Remove comentários para evitar que exemplos sejam interpretados como imports.
 const clean=source.replace(/\/\*[\s\S]*?\*\//g,"");
 const lines=clean.split(/\r?\n/);
 let rulesStarted=false;
 for(let index=0;index<lines.length;index++){
  const line=lines[index].trim();
  if(!line)continue;
  const match=line.match(/^@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*;/);
  if(match){
   if(rulesStarted)throw new Error(`Import CSS após regras: ${path.relative(root,file)}:${index+1}`);
   const url=match[1].split("?")[0].split("#")[0];
   if(/^(https?:)?\/\//.test(url))continue;
   const target=path.resolve(path.dirname(file),url);
   if(!target.startsWith(root+path.sep))throw new Error(`Import fora do repositório: ${url}`);
   await access(target).catch(()=>{throw new Error(`Arquivo CSS ausente: ${path.relative(root,file)}:${index+1} → ${url}`)});
   await inspect(target);
  }else if(!line.startsWith("@charset")&&!line.startsWith("@layer ")&&!line.startsWith("@namespace ")){
   rulesStarted=true;
  }
 }
 count++;
}

for(const entry of entries)await inspect(path.join(root,entry));
console.log(`Auditoria CSS aprovada: ${entries.length} entradas e ${count} arquivos verificados.`);
