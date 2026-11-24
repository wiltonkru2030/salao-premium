/**
 * Inventaria a equivalência byte a byte entre migrations ativas, snapshot
 * recuperado e versões registradas no manifesto de produção.
 * Não conecta ao banco nem altera os arquivos SQL.
 */
import {createHash} from "node:crypto";
import {readdir,readFile} from "node:fs/promises";

const manifest = JSON.parse(await readFile("docs/migrations/remote-history-2026-11-20.json", "utf8"));

/** Lê SQLs e guarda seu hash sem inferir equivalência semântica. */
async function inventory(directory) {
  const entries = await Promise.all((await readdir(directory)).filter(name => name.endsWith(".sql"))
    .map(async name => {
      const content = await readFile(`${directory}/${name}`);
      return {version:name.slice(0,14),name,hash:createHash("sha256").update(content).digest("hex")};
    }));
  return new Map(entries.map(entry => [entry.version,entry]));
}

const active = await inventory("supabase/migrations");
const snapshot = await inventory("supabase/snapshot-remoto/migrations");
const registered = new Set(manifest.versions.map(row => row.version));
const rows = manifest.versions.map(({version,name}) => {
  const current = active.get(version), recovered = snapshot.get(version);
  const status = current && recovered ? (current.hash === recovered.hash ? "identical" : "different")
    : current ? "active_only" : recovered ? "snapshot_only" : "missing";
  return {version,name,status,active:current?.name,snapshot:recovered?.name};
});
const unregistered = [...active.values()].filter(row => !registered.has(row.version)).map(row => ({
  version:row.version,
  active:row.name,
  matchingSnapshot:[...snapshot.values()].filter(other => other.hash === row.hash).map(other => other.name)
}));
const counts = Object.fromEntries(["identical","different","active_only","snapshot_only","missing"]
  .map(status => [status,rows.filter(row => row.status === status).length]));
console.log(JSON.stringify({registered:rows.length,active:active.size,snapshot:snapshot.size,counts,
  exceptions:rows.filter(row => row.status !== "identical"),unregistered},null,2));
