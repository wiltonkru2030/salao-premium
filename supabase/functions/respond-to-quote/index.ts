const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const html = (body: string, status = 200) => new Response(
  `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resposta ao orçamento · SALÃO PREMIUM</title><style>body{font:16px Arial,sans-serif;background:#f7f6f2;color:#222;margin:0;padding:24px}.card{max-width:520px;margin:8vh auto;background:white;border:1px solid #e8e3d9;border-radius:18px;padding:32px;box-shadow:0 12px 40px #0000000b}h1{font-size:24px}p{color:#666;line-height:1.5}.actions{display:flex;gap:12px;flex-wrap:wrap}button{border:0;border-radius:10px;padding:14px 20px;font-weight:700;cursor:pointer}.yes{background:#b49a67;color:#fff}.no{background:#eee;color:#333}</style><main class="card"><small>SALÃO PREMIUM</small>${body}</main></html>`,
  { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", ...cors } }
);
const hex = (bytes: Uint8Array) => [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
async function digest(token: string) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const token = req.method === "GET" ? (url.searchParams.get("token") || "") : "";
  let decision = "";
  let submittedToken = token;
  if (req.method === "POST") {
    const form = await req.formData();
    submittedToken = String(form.get("token") || "");
    decision = String(form.get("decision") || "");
  }
  if (!/^[a-f0-9]{64}$/.test(submittedToken)) {
    return html("<h1>Link inválido</h1><p>Solicite ao salão o envio de um novo orçamento.</p>", 400);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return html("<h1>Serviço indisponível</h1><p>Tente novamente mais tarde.</p>", 503);
  const hash = await digest(submittedToken);
  const headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" };
  const endpoint = supabaseUrl + "/rest/v1/quotes?public_token_hash=eq." + hash + "&status=eq.pending";
  const check = await fetch(endpoint + "&select=id,quote_number,total,valid_until", { headers });
  if (!check.ok) return html("<h1>Não foi possível consultar o orçamento</h1><p>Entre em contato com o salão.</p>", 503);
  const rows = await check.json();
  if (!rows.length) return html("<h1>Orçamento indisponível</h1><p>Este link expirou, já foi respondido ou não é válido. Fale com o salão para receber uma nova proposta.</p>", 404);
  if (rows[0].valid_until && rows[0].valid_until < new Date().toISOString().slice(0,10)) {
    await fetch(endpoint, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ status: "expired" }) });
    return html("<h1>Orçamento expirado</h1><p>O prazo desta proposta terminou. Entre em contato com o salão para receber uma nova.</p>", 410);
  }
  if (req.method === "GET") {
    return html("<h1>Seu orçamento está pronto</h1><p>Orçamento #" + rows[0].quote_number + " · R$ " + Number(rows[0].total).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) + "</p><p>Escolha uma opção para registrar sua resposta ao salão.</p><form method='post' action=''><input type='hidden' name='token' value='" + submittedToken + "'><div class='actions'><button class='yes' name='decision' value='accepted'>Aceitar orçamento</button><button class='no' name='decision' value='rejected'>Recusar orçamento</button></div></form>");
  }
  if (req.method !== "POST" || !["accepted", "rejected"].includes(decision)) return html("<h1>Solicitação inválida</h1>", 405);
  const patch = await fetch(endpoint, { method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(decision === "accepted" ? { status: "accepted", accepted_at: new Date().toISOString() } : { status: "rejected", rejected_at: new Date().toISOString() }) });
  if (!patch.ok) return html("<h1>Não foi possível registrar sua resposta</h1><p>Tente novamente ou fale com o salão.</p>", 503);
  const updated = await patch.json();
  if (!updated.length) return html("<h1>Orçamento já respondido</h1><p>Este link não está mais ativo. Entre em contato com o salão para consultar a situação.</p>", 409);
  return html(decision === "accepted" ? "<h1>Orçamento aceito!</h1><p>Sua resposta foi registrada. O salão entrará em contato para confirmar os horários.</p>" : "<h1>Resposta registrada</h1><p>O salão foi informado de que você não deseja seguir com este orçamento.</p>");
});
