/** Provisionamento administrativo; nunca entrega credenciais de serviço ao navegador. */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
function validCpf(input: string) {
  const cpf = input.replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return null;
  const digit = (base: string, factor: number) => { let sum = 0; for (const value of base) sum += Number(value) * factor--; const rest = (sum * 10) % 11; return rest === 10 ? 0 : rest; };
  if (digit(cpf.slice(0, 9), 10) !== Number(cpf[9]) || digit(cpf.slice(0, 10), 11) !== Number(cpf[10])) return null;
  return cpf;
}
async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map(v => v.toString(16).padStart(2, "0")).join("");
}
function temporaryPassword() { const bytes = crypto.getRandomValues(new Uint8Array(18)); return "Sp!" + [...bytes].map(v => v.toString(16).padStart(2, "0")).join("") + "a9"; }
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return json({ error: "Configuração administrativa incompleta." }, 503);
  let locks:ReturnType<typeof operationLocks>|null=null;
  try {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    locks=operationLocks(admin);
    const secretResult=await admin.rpc("get_professional_cpf_login_pepper");
    const pepper=typeof secretResult.data==="string"?secretResult.data:null;
    if (secretResult.error||!pepper||pepper.length<32) return json({ error: "A chave privada de autenticação não está disponível." }, 503);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Acesso administrativo obrigatório." }, 401);
    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: "Bearer " + token } }, auth: { persistSession: false } });
    const { data: caller, error: callerError } = await callerClient.auth.getUser(token);
    if (callerError || !caller.user) return json({ error: "Sessão inválida." }, 401);
    const body = await req.json(), orgId = String(body?.org_id || ""), professionalId = String(body?.professional_id || ""), cpf = validCpf(String(body?.cpf || "")), action = String(body?.action || "create");
    if (!orgId || !professionalId || !cpf || !["create", "reset"].includes(action)) return json({ error: "Dados inválidos." }, 400);
    const { data: membership } = await callerClient.from("org_memberships").select("role,status").eq("org_id", orgId).eq("user_id", caller.user.id).eq("status", "active").maybeSingle();
    if (!membership || !["owner", "admin"].includes(membership.role)) return json({ error: "Somente administrador do salão pode gerenciar acessos." }, 403);
    if(!await locks.acquire("professional:"+professionalId))return json({error:"Outra alteração de acesso está em andamento. Tente novamente."},409);
    const { data: professional, error: professionalError } = await admin.from("professionals").select("id,org_id,name,profile_id,active").eq("id", professionalId).eq("org_id", orgId).maybeSingle();
    if (professionalError || !professional || !professional.active) return json({ error: "Profissional não encontrado ou inativo." }, 404);
    const cpfHash = await hmac("cpf:" + cpf, pepper), email = "pro-" + cpfHash.slice(0, 40) + "@login.salaopremium.invalid", password = temporaryPassword();
    let authUserId: string | null = null;
    if (professional.profile_id) {
      const { data: linkedMembership,error: linkedMembershipError } = await admin.from("org_memberships")
        .select("role,status")
        .eq("org_id", orgId)
        .eq("user_id", professional.profile_id)
        .eq("status", "active")
        .maybeSingle();
      const { data: linkedProfessional,error: linkedProfessionalError } = await admin.from("professionals")
        .select("id")
        .eq("org_id", orgId)
        .eq("profile_id", professional.profile_id)
        .neq("id", professionalId)
        .limit(1)
        .maybeSingle();

      if(linkedMembershipError||linkedProfessionalError)return json({error:"Não foi possível verificar os vínculos."},503);
      // Reuse only a profile already dedicated to this professional; never change an owner's or receptionist's login.
      if (linkedMembership?.role === "professional" && !linkedProfessional) {
        const {data:otherLinks,error:otherError}=await admin.from("org_memberships").select("org_id,role").eq("user_id",professional.profile_id).neq("org_id",orgId);
        if(otherError||otherLinks?.length)return json({error:"Conta vinculada a outro salão. Solicite suporte para redefinição global."},409);
        authUserId = professional.profile_id;
        if(!await locks.acquire("user:"+authUserId))return json({error:"Outra alteração de senha está em andamento. Tente novamente."},409);
        const { error } = await admin.auth.admin.updateUserById(authUserId, {
          email, password, email_confirm: true,
          app_metadata: { professional_password_required: true, professional_password_generation: crypto.randomUUID() },
          user_metadata: { full_name: professional.name, account_type: "professional", must_change_password: true }
        });
        if (error) return json({ error: "Não foi possível atualizar o acesso deste profissional." }, 400);
      }
    }
    if (!authUserId) {
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        app_metadata: { professional_password_required: true, professional_password_generation: crypto.randomUUID() },
          user_metadata: { full_name: professional.name, account_type: "professional", must_change_password: true }
      });
      if (error || !data.user) return json({ error: "Não foi possível criar a conta profissional." }, 400);
      authUserId = data.user.id;
    }
    const { error: profileError } = await admin.from("profiles").upsert({ id: authUserId, full_name: professional.name });
    if (profileError) return json({ error: "Conta criada, mas o perfil não pôde ser vinculado. Contate o suporte." }, 500);
    const { error: membershipError } = await admin.from("org_memberships").upsert({ org_id: orgId, user_id: authUserId, role: "professional", status: "active", professional_app_enabled: true, professional_app_scope: "self" }, { onConflict: "org_id,user_id" });
    if (membershipError) return json({ error: "Conta criada, mas a permissão não pôde ser vinculada." }, 500);
    const { error: updateError } = await admin.from("professionals").update({ profile_id: authUserId, access_enabled: true }).eq("id", professionalId).eq("org_id", orgId);
    if (updateError) return json({ error: "Conta criada, mas não foi possível ativar o acesso." }, 500);
    const { error: identityError } = await admin.rpc("register_professional_login", { p_org_id: orgId, p_professional_id: professionalId, p_auth_user_id: authUserId, p_cpf_hmac: "\\x" + cpfHash, p_enabled: true });
    if (identityError) return json({ error: "Conta criada, mas não foi possível registrar o CPF com segurança." }, 500);
    return json({ success: true, professional_name: professional.name, temporary_password: password, message: action === "reset" ? "Senha temporária redefinida. Ela será exibida somente agora." : "Acesso criado. Entregue a senha temporária por um canal seguro." });
  } catch (_error) { return json({ error: "Não foi possível gerenciar este acesso. Tente novamente." }, 400); }
  finally{await locks?.release();}
});