/** Conclusão da senha inicial: autenticação real, reautenticação e alteração administrativa.
 * Não aceita IDs de usuário, salão ou tokens de outras contas no corpo.
 * Deve ser implantada junto ao gate SQL e ao provisionamento atualizado.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
/** Coordena o mesmo usuário nas duas Edge Functions. Se houver interrupção, a trava permanece
 * até revisão de suporte; não libera outra operação enquanto alteração Auth pode estar em curso.
 */
function operationLocks(admin:ReturnType<typeof createClient>){
 const holder=crypto.randomUUID(),keys:string[]=[];
 return {
  async acquire(key:string){
   const {data,error}=await admin.rpc("acquire_professional_auth_lock",{operation_key:key,operation_holder:holder});
   if(error||data!==true)return false;
   keys.push(key);return true;
  },
  async release(){
   for(const key of keys.reverse()){
    try{await admin.rpc("release_professional_auth_lock",{operation_key:key,operation_holder:holder});}catch{/* revisão manual, não libera outra operação */}
   }
  }
 };
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Método não permitido."},405);
 const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),anonKey=Deno.env.get("SUPABASE_ANON_KEY");
 if(!url||!serviceKey||!anonKey)return json({error:"Serviço indisponível."},503);
 let locks:ReturnType<typeof operationLocks>|null=null;
 try{
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token)return json({error:"Sessão obrigatória."},401);
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  locks=operationLocks(admin);
  const client=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.getUser(token);
  const user=data.user;
  if(error||!user?.email||user.app_metadata?.professional_password_required!==true||!user.app_metadata?.professional_password_generation)return json({error:"Troca provisória não autorizada."},403);
  const body=await req.json();
  const current=body?.current_password,next=body?.new_password;
  if(typeof current!=="string"||!current||current.length>128||typeof next!=="string"||next.length<10||new TextEncoder().encode(next).length>72||current===next)return json({error:"Confira as senhas."},400);
  const {data:members,error:membershipError}=await admin.from("org_memberships").select("org_id,role,status").eq("user_id",user.id);
  const {data:profiles,error:profileError}=await admin.from("professionals").select("org_id,active,access_enabled").eq("profile_id",user.id);
  if(membershipError||profileError||!members?.some(m=>m.role==="professional"&&m.status==="active"&&profiles?.some(p=>p.org_id===m.org_id&&p.active&&p.access_enabled))||members?.some(m=>m.role!=="professional"))return json({error:"Vínculo profissional indisponível."},403);
  if(!await locks.acquire("user:"+user.id))return json({error:"Outra alteração de senha está em andamento. Tente novamente."},409);
  const before=await admin.auth.admin.getUserById(user.id);
  if(before.error||before.data.user?.app_metadata?.professional_password_required!==true||before.data.user?.app_metadata?.professional_password_generation!==user.app_metadata.professional_password_generation)return json({error:"A senha foi redefinida. Entre novamente."},409);
  // Auth valida a senha atual e aplica seu limite de tentativas.
  const {data:verified,error:verifyError}=await client.auth.signInWithPassword({email:user.email,password:current});
  if(verifyError||verified.user?.id!==user.id||!verified.session)return json({error:"Senha temporária inválida."},401);
  const {data:latest,error:latestError}=await admin.auth.admin.getUserById(user.id);
  if(latestError||latest.user?.app_metadata?.professional_password_required!==true||latest.user?.app_metadata?.professional_password_generation!==user.app_metadata.professional_password_generation){
   await client.auth.signOut({scope:"local"});return json({error:"A senha foi redefinida. Entre novamente."},409);
  }
  // Revoga refresh tokens existentes antes de alterar a geração. O gate rejeita JWTs antigos.
  const {error:signOutError}=await admin.auth.admin.signOut(verified.session.access_token,"global");
  if(signOutError)return json({error:"Não foi possível encerrar sessões anteriores."},503);
  const {error:updateError}=await admin.auth.admin.updateUserById(user.id,{
   password:next,
   app_metadata:{professional_password_required:false,professional_password_generation:crypto.randomUUID()},
   user_metadata:{must_change_password:false}
  });
  if(updateError)return json({error:"Não foi possível atualizar a senha."},400);
  return json({success:true});
 }catch{return json({error:"Não foi possível concluir a troca de senha."},500);}
 finally{await locks?.release();}
});
