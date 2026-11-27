/** Smoke live: compara artefatos públicos do build sem autenticar ou alterar dados. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {setTimeout as delay} from "node:timers/promises";
const origin=new URL(process.env.LIVE_URL||"");
assert.equal(origin.origin,"https://salao-premium.web.app");
assert.equal(origin.pathname,"/");
const entries=["/index.html","/cliente/index.html","/professional/index.html","/professional/sw.js","/professional/manifest.webmanifest"];
async function check(path){
 const response=await fetch(new URL(path,origin),{redirect:"error",signal:AbortSignal.timeout(20000),headers:{"Cache-Control":"no-cache"}});
 assert.ok(response.ok,path+" HTTP "+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());
 assert.deepEqual(bytes,readFileSync("dist"+path),"Versão diferente: "+path);
 if(path.endsWith(".html")){
  const script=bytes.toString("utf8").match(/<script\b[^>]*\bsrc=["']([^"']+\.js)["']/i)?.[1];
  assert.ok(script,"Entrada JS ausente: "+path);
  const asset=new URL(script,new URL(path,origin));
  assert.equal(asset.origin,origin.origin);
  const js=await fetch(asset,{redirect:"error",signal:AbortSignal.timeout(20000)});
  assert.ok(js.ok);
  assert.deepEqual(Buffer.from(await js.arrayBuffer()),readFileSync("dist"+asset.pathname),"JS diferente: "+asset.pathname);
 }
}
for(let attempt=0;;attempt++){
 try{for(const path of entries)await check(path);break;}
 catch(error){if(attempt>=7)throw error;console.log("Aguardando propagação do build live: tentativa "+(attempt+1));await delay(5000);}
}
console.log("LIVE_HOSTING_VERIFIED="+origin.href);
