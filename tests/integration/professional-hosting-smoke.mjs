/** Verificação pós-deploy: somente canal temporário QA, sem autenticar nem alterar dados.
 * Confere a página e os assets PWA servidos pelo Hosting, incluindo tipo MIME do worker.
 */
import assert from "node:assert/strict";
import {appendFileSync,readFileSync} from "node:fs";
import {setTimeout as delay} from "node:timers/promises";
const origin=new URL(process.env.QA_PREVIEW_URL||"");
assert.equal(origin.protocol,"https:");
assert.match(origin.hostname,/^salao-premium--professional-qa-[a-z0-9-]+\.web\.app$/,"Destino não é o canal QA previsto.");
assert.equal(origin.username+origin.password+origin.search+origin.hash,"");
async function get(path){
 const url=new URL(path,origin);
 assert.equal(url.origin,origin.origin);
 const response=await fetch(url,{redirect:"error",signal:AbortSignal.timeout(20000),headers:{"Cache-Control":"no-cache"}});
 assert.ok(response.ok,"Hosting QA: "+path+" HTTP "+response.status);
 return response;
}
/** Firebase/CDN pode responder a versão anterior imediatamente após o deploy.
 * Repetição limitada, sem aceitar HTML antigo nem relaxar a comparação de bytes.
 */
const expected=readFileSync("dist/professional/index.html","utf8");
let html,verified=false,lastError;
for(let attempt=0;attempt<8;attempt++){
 try{
  const page=await get("/professional/index.html");
  assert.match(page.headers.get("content-type")||"",/text\/html/);
  html=await page.text();
  assert.ok(html===expected,"HTML publicado não corresponde ao pacote atual");
  const entry=await get("/professional/");
  assert.match(entry.headers.get("cache-control")||"",/no-store/,"Entrada PWA deve impedir cache antigo");
  assert.ok(await entry.text()===expected,"Entrada PWA diferente do pacote atual");
  verified=true;break;
 }catch(error){lastError=error;console.log("Conferência da versão publicada: tentativa "+(attempt+1)+"/8");if(attempt<7)await delay(5000);}
}
if(!verified)throw lastError;
assert.match(html,/SALÃO PREMIUM/);
const script=html.match(/<script\b[^>]*\bsrc=["']([^"']+\.js)["']/i)?.[1];
assert.ok(script,"Entrada JS não encontrada.");
const js=await get(script);
assert.match(js.headers.get("content-type")||"",/(?:javascript|ecmascript)/i);
assert.deepEqual(Buffer.from(await js.arrayBuffer()),readFileSync("dist"+new URL(script,origin).pathname),"JS publicado não corresponde ao pacote atual");
const worker=await get("/professional/sw.js");
assert.match(worker.headers.get("content-type")||"",/(?:javascript|ecmascript)/i);
assert.match(await worker.text(),/onBackgroundMessage/);
const manifest=await get("/professional/manifest.webmanifest");
const data=await manifest.json();
assert.ok(data.name&&data.start_url,"Manifesto incompleto.");
const icon=await get("/professional/icon.svg");
assert.match(icon.headers.get("content-type")||"",/image\/svg\+xml/);
// O Hosting não pode substituir os ícones por HTML de fallback.
for(const [name,mime] of [["notification-icon.webp","image/webp"],["notification-badge.png","image/png"]]){
 const response=await get("/professional/"+name);
 assert.ok((response.headers.get("content-type")||"").includes(mime));
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),readFileSync("dist/professional/"+name));
}
const link=new URL("/professional/",origin).href;
console.log("QA_PREVIEW_VERIFIED="+link);
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,"App Profissional QA publicado e assets verificados: "+link+"\n");
