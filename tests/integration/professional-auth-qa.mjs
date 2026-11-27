/** Homologação de Auth profissional real, somente no projeto QA dedicado.
 * Usa credenciais aleatórias em memória e remove exclusivamente registros da execução.
 * Não imprime senhas, CPF, tokens, respostas HTTP ou chaves.
 */
import assert from "node:assert/strict";
import {randomBytes,randomInt,randomUUID} from "node:crypto";
const url="https://eaiutjqvyesboldcznyr.supabase.co";
assert.equal(process.env.SUPABASE_TEST_ENV,"isolated","Somente QA.");
assert.equal(process.env.SUPABASE_URL,url,"Destino QA obrigatório.");
const anon=process.env.SUPABASE_PUBLISHABLE_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(anon&&service,"Configure as credenciais exclusivamente de QA.");
const run=randomUUID(),orgName="QA Auth "+run,email="qa-auth-"+run+"@example.invalid";
const password=()=>"Aa9!"+randomBytes(24).toString("hex");
const ownerPassword=password(),newPassword=password(),secondPassword=password();
const ids={owner:null,org:null,professional:null,user:null};
const allowedTables=new Set(["organizations","branches","profiles","org_memberships","professionals","customers","audit_events","audit_logs","recycle_bin"]);
/** HTTP restrito ao projeto QA fixo, com timeout e sem log de conteúdo. */
async function request(path,{method="GET",token=null,admin=false,body,prefer}={}){
 const headers={apikey:admin?service:anon,"Content-Type":"application/json"};
 if(admin)headers.Authorization="Bearer "+service;else if(token)headers.Authorization="Bearer "+token;
 if(prefer)headers.Prefer=prefer;
 const response=await fetch(url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 const data=await response.json().catch(()=>null);
 return {ok:response.ok,status:response.status,data};
}
/** Mensagens mostram somente o passo e HTTP, nunca payloads sensíveis. */
function ok(result,label){assert.ok(result.ok,label+" (HTTP "+result.status+")");return result.data;}
function denied(result,label){assert.ok(!result.ok,label+" deveria ser negado");}
const rest=(table,query="",options={})=>{assert.ok(allowedTables.has(table));return request("/rest/v1/"+table+(query?"?"+query:""),options);};
const rpc=(name,body,token)=>request("/rest/v1/rpc/"+name,{method:"POST",token,body});
const edge=(name,body,token)=>request("/functions/v1/"+name,{method:"POST",token,body});
const signIn=(email,password)=>request("/auth/v1/token?grant_type=password",{method:"POST",body:{email,password}});
/** CPF sintético válido para o algoritmo, criado apenas no ambiente isolado. */
function fakeCpf(){
 const digits=Array.from({length:9},()=>randomInt(10));
 for(let n=9;n<11;n++){const rest=digits.reduce((sum,d,i)=>sum+d*(n+1-i),0)*10%11;digits.push(rest===10?0:rest);}
 return digits.join("");
}
let executionError=null,cleanupError=null;
try{
 const owner=ok(await request("/auth/v1/admin/users",{method:"POST",admin:true,body:{email,password:ownerPassword,email_confirm:true,user_metadata:{full_name:"QA Auth",organization_name:orgName}}}),"Criar proprietário fictício");
 ids.owner=owner.id;
 const ownerSession=ok(await signIn(email,ownerPassword),"Login proprietário");
 const memberships=ok(await rest("org_memberships","select=org_id,role&user_id=eq."+ids.owner,{token:ownerSession.access_token}),"Vínculo proprietário");
 assert.equal(memberships.length,1);assert.equal(memberships[0].role,"owner");ids.org=memberships[0].org_id;
 const org=ok(await rest("organizations","select=id,name&id=eq."+ids.org,{admin:true}),"Conferir salão QA")[0];
 assert.equal(org.name,orgName);
 const branch=ok(await rest("branches","select=id&org_id=eq."+ids.org+"&is_main=eq.true",{admin:true}),"Conferir matriz")[0];
 assert.ok(branch?.id);
 ids.professional=randomUUID();
 ok(await rest("professionals","",{method:"POST",admin:true,prefer:"return=minimal",body:{id:ids.professional,org_id:ids.org,branch_id:branch.id,name:"QA Profissional",active:true,access_enabled:true}}),"Criar profissional");
 const cpf=fakeCpf();
 const create=ok(await edge("manage-professional-access",{org_id:ids.org,professional_id:ids.professional,cpf,action:"create"},ownerSession.access_token),"Provisionar CPF");
 const professional=ok(await rest("professionals","select=profile_id&id=eq."+ids.professional+"&org_id=eq."+ids.org,{admin:true}),"Conferir conta")[0];ids.user=professional.profile_id;
 assert.ok(ids.user&&create.temporary_password);
 const temporary=ok(await edge("professional-cpf-login",{cpf,password:create.temporary_password}),"Login CPF e senha inicial");
 const token=temporary.access_token;assert.ok(token);
 const getUser=ok(await request("/auth/v1/user",{token}),"Sessão profissional");
 assert.equal(getUser.id,ids.user);assert.equal(getUser.app_metadata.professional_password_required,true);
 const args={target_org:ids.org,target_unit:branch.id,page_offset:0};
 denied(await rpc("list_professional_unit_customers_at_branch",args,token),"Carteira antes de trocar senha");
 denied(await edge("complete-professional-password",{current_password:password(),new_password:newPassword},token),"Senha atual incorreta");
 ok(await edge("complete-professional-password",{current_password:create.temporary_password,new_password:newPassword},token),"Troca provisória");
 denied(await rpc("list_professional_unit_customers_at_branch",args,token),"JWT antigo");
 denied(await edge("professional-cpf-login",{cpf,password:create.temporary_password}),"Senha temporária antiga");
 const current=ok(await edge("professional-cpf-login",{cpf,password:newPassword}),"Login após troca");
 const fresh=ok(await request("/auth/v1/user",{token:current.access_token}),"Sessão renovada");
 assert.equal(fresh.app_metadata.professional_password_required,false);
 ok(await rpc("list_professional_unit_customers_at_branch",args,current.access_token),"Carteira após troca");
 const reset=ok(await edge("manage-professional-access",{org_id:ids.org,professional_id:ids.professional,cpf,action:"reset"},ownerSession.access_token),"Redefinir senha profissional");
 denied(await rpc("list_professional_unit_customers_at_branch",args,current.access_token),"Token após reset");
 const again=ok(await edge("professional-cpf-login",{cpf,password:reset.temporary_password}),"Login temporário após reset");
 ok(await edge("complete-professional-password",{current_password:reset.temporary_password,new_password:secondPassword},again.access_token),"Concluir segunda troca");
 const final=ok(await edge("professional-cpf-login",{cpf,password:secondPassword}),"Login definitivo");
 ok(await rpc("list_professional_unit_customers_at_branch",args,final.access_token),"Carteira autorizada");
 console.log("Auth profissional: provisionamento, CPF, senha provisória, reset e gate aprovados.");
}catch(error){executionError=error;}
finally{
 try{
  // Se o provisionamento falhar após vincular a conta, recupera apenas o perfil do ID criado.
  if(ids.professional&&ids.org&&!ids.user){
   const rows=ok(await rest("professionals","select=profile_id&id=eq."+ids.professional+"&org_id=eq."+ids.org,{admin:true}),"Recuperar conta de limpeza");
   ids.user=rows[0]?.profile_id||null;
  }
  // Não remove organização se o nome e o UUID do cenário não coincidirem.
  if(ids.org){
   const rows=ok(await rest("organizations","select=id,name&id=eq."+ids.org,{admin:true}),"Identificar cenário");
   assert.ok(!rows.length||rows[0].name===orgName,"Limpeza bloqueada: cenário divergente.");
   for(const table of ["audit_events","audit_logs","recycle_bin"])ok(await rest(table,"org_id=eq."+ids.org,{method:"DELETE",admin:true}),"Limpar "+table);
   ok(await rest("organizations","id=eq."+ids.org,{method:"DELETE",admin:true}),"Remover salão fictício");
   assert.equal(ok(await rest("organizations","select=id&id=eq."+ids.org,{admin:true}),"Conferir salão removido").length,0);
  }
  for(const id of [ids.user,ids.owner].filter(Boolean)){
   ok(await request("/auth/v1/admin/users/"+id,{method:"DELETE",admin:true}),"Remover conta fictícia");
   const check=await request("/auth/v1/admin/users/"+id,{admin:true});assert.equal(check.status,404,"Conta fictícia permaneceu");
  }
  if(ids.org)for(const table of ["audit_events","audit_logs","recycle_bin"])ok(await rest(table,"org_id=eq."+ids.org,{method:"DELETE",admin:true}),"Remover resíduos "+table);
  console.log("Limpeza das contas e salão fictícios conferida.");
 }catch(error){cleanupError=error;console.error("Falha de limpeza; IDs do cenário QA:",ids);}
}
if(cleanupError)throw cleanupError;
if(executionError)throw executionError;
