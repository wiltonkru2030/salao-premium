import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function validCpf(input: string) {
  const cpf = input.replace(/\\D/g, "");
  if (!/^\\d{11}$/.test(cpf) || /^(\\d)\\1{10}$/.test(cpf)) return null;
  const digit = (base: string, factor: number) => {
    let sum = 0;
    for (const value of base) sum += Number(value) * factor--;
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  if (digit(cpf.slice(0, 9), 10) !== Number(cpf[9]) || digit(cpf.slice(0, 10), 11) !== Number(cpf[10])) return null;
  return cpf;
}
async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map(v => v.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const pepper = Deno.env.get("CPF_LOGIN_PEPPER"), url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!pepper || !url || !serviceKey || !anonKey) return json({ error: "A autenticação profissional ainda não foi configurada pelo administrador." }, 503);
  try {
    const body = await req.json(), cpf = validCpf(String(body?.cpf || "")), password = String(body?.password || "");
    if (!cpf || password.length < 8 || password.length > 128) return json({ error: "CPF ou senha inválidos." }, 400);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const ipHash = await hmac("professional-login:" + ip, pepper);
    const rate = await admin.rpc("consume_professional_login_attempt", { p_attempt_key: "\\\\x" + ipHash });
    if (rate.error || rate.data !== true) return json({ error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." }, 429);
    const cpfHash = await hmac("cpf:" + cpf, pepper);
    const resolved = await admin.rpc("resolve_professional_login", { p_cpf_hmac: "\\\\x" + cpfHash });
    const identity = Array.isArray(resolved.data) ? resolved.data[0] : resolved.data;
    if (resolved.error || !identity?.auth_user_id) return json({ error: "CPF ou senha inválidos." }, 401);
    const { data: authUser, error: userError } = await admin.auth.admin.getUserById(identity.auth_user_id);
    if (userError || !authUser.user?.email) return json({ error: "CPF ou senha inválidos." }, 401);
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: session, error } = await client.auth.signInWithPassword({ email: authUser.user.email, password });
    if (error || !session.session) return json({ error: "CPF ou senha inválidos." }, 401);
    return json({ access_token: session.session.access_token, refresh_token: session.session.refresh_token, expires_at: session.session.expires_at });
  } catch (_error) { return json({ error: "Não foi possível concluir o acesso. Tente novamente." }, 400); }
});