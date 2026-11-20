/** Compara apenas nomes de versões da pasta ativa e do inventário remoto.
 * Não conecta ao banco, não executa SQL e não repara o histórico.
 * Divergências e versões duplicadas bloqueiam a verificação.
 */
import {readdir,readFile} from "node:fs/promises";
const manifestPath=process.argv[2]||"docs/migrations/remote-history-2026-11-20.json";
const manifest=JSON.parse(await readFile(manifestPath,"utf8"));
const remote=manifest.versions;
if(!Array.isArray(remote)||remote.some(x=>!/^\d{14}$/.test(x.version)))throw new Error("Inventário remoto inválido.");
const files=(await readdir("supabase/migrations")).filter(x=>x.endsWith(".sql"));
const byVersion=new Map(),invalid=[];
for(const name of files){
 const match=/^(\d{14})_.+\.sql$/.exec(name);
 if(!match){invalid.push(name);continue;}
 const version=match[1];byVersion.set(version,[...(byVersion.get(version)||[]),name]);
}
const remoteList=remote.map(x=>x.version),remoteVersions=new Set(remoteList);
const duplicateRemote=remoteList.filter((v,i)=>remoteList.indexOf(v)!==i);
const duplicateLocal=[...byVersion].filter(([,names])=>names.length>1);
const onlyRemote=remote.filter(x=>!byVersion.has(x.version));
const onlyLocal=[...byVersion].filter(([version])=>!remoteVersions.has(version));
const result={inventario:manifestPath,arquivos:files.length,versoesRemotas:remote.length,nomesInvalidos:invalid,duplicadasLocais:duplicateLocal,duplicadasRemotas:duplicateRemote,apenasRemotas:onlyRemote,apenasLocais:onlyLocal};
console.log(JSON.stringify(result,null,2));
if([invalid,duplicateRemote,duplicateLocal,onlyRemote,onlyLocal].some(x=>x.length)){
 console.error("Histórico divergente: não executar db push nem reparar sem revisão.");
 process.exitCode=1;
}else console.log("Versões coincidentes; conteúdo SQL, dependências e replay ainda exigem validação.");
