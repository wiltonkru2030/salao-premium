/** Entrega FCM v1 de avisos genéricos. Autentica o workflow por OIDC e usa conta de serviço em secret.
 * Não recebe token de dispositivo nem conteúdo do cliente; a fila SQL é a única fonte.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.119.0";
import {createRemoteJWKSet,jwtVerify} from "npm:jose@6.2.18";
import {allowedDispatchClaims} from "./auth-claims.js";
import {validateFirebaseTransport} from "./validate-transport.js";
const jwks=createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),{timeoutDuration:5000});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const bytes=(text:string)=>new TextEncoder().encode(text);
function base64url(input:Uint8Array){return btoa(String.fromCharCode(...input)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");}
function encode(value:unknown){return base64url(bytes(JSON.stringify(value)));}
/** OAuth de curta duração, assinado com chave PKCS#8 exclusivamente no servidor. */
async function accessToken(account:{client_email:string,private_key:string}){
 const pem=account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");
 const key=await crypto.subtle.importKey("pkcs8",Uint8Array.from(atob(pem),ch=>ch.charCodeAt(0)),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const now=Math.floor(Date.now()/1000);
 const unsigned=encode({alg:"RS256",typ:"JWT"})+"."+encode({iss:account.client_email,scope:"https://www.googleapis.com/auth/firebase.messaging",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600});
 const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,bytes(unsigned));
 const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:unsigned+"."+base64url(new Uint8Array(sig))}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error("OAuth indisponível");
 const value=await response.json();if(typeof value.access_token!=="string")throw new Error("OAuth inválido");return value.access_token;
}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"Método não permitido."},405);
 const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),accountJSON=Deno.env.get("PROFESSIONAL_FCM_SERVICE_ACCOUNT"),projectId=Deno.env.get("PROFESSIONAL_FCM_PROJECT_ID")||"salao-premium";
 if(!url)return json({error:"Serviço indisponível."},503);
 // JWT externo: gateway não valida tokens do GitHub; a verificação é feita aqui,
 // com assinatura, emissor, audiência exclusiva do projeto e escopo exato do workflow.
 let mode:string;
 try{
  const body=await req.json();mode=body?.mode;
  if(!["check","send"].includes(mode))return json({error:"Modo inválido."},400);
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token||token.length>8192)return json({error:"Acesso não autorizado."},401);
  const {payload}=await jwtVerify(token,jwks,{issuer:"https://token.actions.githubusercontent.com",audience:url.replace(/\/$/,"")+"/functions/v1/dispatch-professional-push",algorithms:["RS256"],requiredClaims:["exp","iat","sub"],maxTokenAge:"5m"});
  if(!allowedDispatchClaims(payload,mode))return json({error:"Acesso não autorizado."},403);
 }catch{return json({error:"Acesso não autorizado."},401);}
 let account;
 try{account=JSON.parse(accountJSON||"{}");}catch{account={};}
 const configured=!!(serviceKey&&account.project_id===projectId&&typeof account.client_email==="string"&&typeof account.private_key==="string"&&/^[a-z0-9-]{4,64}$/.test(projectId));
 // O modo check nunca reserva a fila nem entrega uma mensagem. Verifica OAuth e FCM reais.
 if(mode==="check"){
  if(!configured)return json({authenticated:true,transportConfigured:false,oauthValidated:false,fcmValidated:false});
  let bearer:string;
  try{bearer=await accessToken(account);}catch{return json({authenticated:true,transportConfigured:true,oauthValidated:false,fcmValidated:false});}
  try{
   const probe=await validateFirebaseTransport({projectId,bearer});
   return json({authenticated:true,transportConfigured:true,oauthValidated:true,fcmValidated:probe.validated,fcmHttpStatus:probe.httpStatus});
  }catch{return json({authenticated:true,transportConfigured:true,oauthValidated:true,fcmValidated:false});}
 }
 if(!configured||!serviceKey)return json({error:"Transporte não configurado."},503);
 try{
  // Confirma credencial antes de reservar qualquer entrega.
  const bearer=await accessToken(account);
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:jobs,error}=await admin.rpc("claim_professional_push_deliveries");
  if(error||!Array.isArray(jobs))return json({error:"Fila indisponível."},503);
  let sent=0,retry=0,invalid=0,unconfirmed=0;
  // Limite de paralelismo protege tempo de execução e quota; cada reserva é confirmada separadamente.
  for(let i=0;i<jobs.length;i+=6)await Promise.all(jobs.slice(i,i+6).map(async job=>{
   let outcome="retry";
   try{
    const response=await fetch("https://fcm.googleapis.com/v1/projects/"+projectId+"/messages:send",{
     method:"POST",headers:{Authorization:"Bearer "+bearer,"Content-Type":"application/json"},
     body:JSON.stringify({message:{token:job.token,data:{kind:"professional_update",notification_id:job.notification_id},webpush:{headers:{TTL:"300",Urgency:"normal"}}}}),signal:AbortSignal.timeout(8000)
    });
    if(response.ok)outcome="sent";
    else{
     const body=await response.json().catch(()=>null);
     if(body?.error?.details?.some((d:{errorCode?:string})=>d.errorCode==="UNREGISTERED"))outcome="invalid";
    }
   }catch{/* resposta ambígua usa lease/retry; entrega externa pode se repetir */}
   const result=await admin.rpc("finish_professional_push_delivery",{target_notification:job.notification_id,target_device:job.device_id,target_lease:job.lease_id,outcome});
   if(result.error||result.data!==true){unconfirmed++;return;}
   if(outcome==="sent")sent++;else if(outcome==="invalid")invalid++;else retry++;
  }));
  return json({sent,retry,invalid,unconfirmed});
 }catch{return json({error:"Não foi possível processar a fila."},503);}
});
