/**
 * Teste de integração ponta a ponta do backend do SALÃO PREMIUM (Supabase real).
 *
 * Cria dois salões de teste independentes (A e B) e um profissional do salão A, executa os fluxos
 * operacionais e financeiros pelas mesmas tabelas/RPCs usadas pelo painel e verifica isolamento
 * multi-tenant e permissões por papel. Ao final, remove todas as contas e dados de teste
 * (use --keep para preservá-los e inspecionar).
 *
 * Execução: node tests/integration/backend-flows.test.mjs
 * Requer: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e SUPABASE_SERVICE_ROLE_KEY no ambiente.
 */
import assert from "node:assert/strict";
import { admin, signIn, assertEnvironment } from "./lib/supabase-http.mjs";

assertEnvironment();
const KEEP = process.argv.includes("--keep");
const RUN = Date.now().toString(36);
const PASSWORD = "Teste#" + RUN + "Aa1";
const results = [];
const created = { users: [], orgs: [] };

async function step(name, fn) {
  try { await fn(); results.push(["ok", name]); console.log("  ✓ " + name); }
  catch (error) { results.push(["fail", name]); console.log("  ✗ " + name + "\n      " + (error?.message || error)); }
}
const expectOk = (r, label) => { assert.ok(r.ok, label + ": " + r.error); return r.data; };
const expectFail = (r, label, pattern) => {
  assert.ok(!r.ok, label + ": deveria ter sido bloqueado");
  if (pattern) assert.match(String(r.error), pattern, label + ": mensagem inesperada → " + r.error);
};
const isoAt = (daysAhead, hour, minute = 0) => {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + daysAhead); d.setUTCHours(hour, minute, 0, 0); return d.toISOString();
};
const plusMinutes = (iso, minutes) => new Date(new Date(iso).getTime() + minutes * 60000).toISOString();

async function createOwner(tag) {
  const email = `qa-${RUN}-${tag}@salaopremium.test`;
  const user = expectOk(await admin.createUser(email, PASSWORD, { full_name: "QA " + tag, organization_name: "[TESTE] Salão " + tag.toUpperCase() }), "criar proprietário " + tag);
  created.users.push(user.id);
  const session = await signIn(email, PASSWORD);
  const membership = expectOk(await session.select("org_memberships", "select=org_id,role&user_id=eq." + user.id), "ler vínculo")[0];
  assert.equal(membership.role, "owner");
  created.orgs.push(membership.org_id);
  return { ...session, email, orgId: membership.org_id };
}

console.log("\nSALÃO PREMIUM · teste de integração do backend (" + RUN + ")\n");
const A = await createOwner("a");
const B = await createOwner("b");
const ctx = {};

await step("1. Proprietário cria cliente com dados válidos", async () => {
  ctx.customer = expectOk(await A.insert("customers", { org_id: A.orgId, name: "Cliente Teste " + RUN, phone: "(92) 99999-0000", tags: [] }), "cliente")[0];
  ctx.customer2 = expectOk(await A.insert("customers", { org_id: A.orgId, name: "Cliente Dois " + RUN, tags: [] }), "cliente 2")[0];
});

await step("2. Cria serviços, produto e profissional MEI vinculado só aos serviços de unhas", async () => {
  ctx.nails = expectOk(await A.insert("services", { org_id: A.orgId, name: "Manicure QA", duration_minutes: 45, price: 100, category: "Unhas" }), "serviço")[0];
  ctx.hair = expectOk(await A.insert("services", { org_id: A.orgId, name: "Corte QA", duration_minutes: 60, price: 150, category: "Cabelo" }), "serviço 2")[0];
  ctx.product = expectOk(await A.insert("products", { org_id: A.orgId, name: "Esmalte QA", cost_price: 10, sale_price: 50, stock_quantity: 10, min_stock: 1 }), "produto")[0];
  expectFail(await A.insert("professionals", { org_id: A.orgId, name: "MEI sem CNPJ", tax_regime: "mei" }), "MEI exige CNPJ");
  ctx.pro = expectOk(await A.insert("professionals", { org_id: A.orgId, name: "Profissional QA", commission_rate: 40, tax_regime: "mei", cnpj: "11.222.333/0001-81" }), "profissional")[0];
  expectOk(await A.insert("professional_services", { org_id: A.orgId, professional_id: ctx.pro.id, service_id: ctx.nails.id }), "vínculo serviço");
});

await step("3. Agenda: cria agendamento e bloqueia serviço não autorizado e conflito de horário", async () => {
  const start = isoAt(3, 13);
  const base = { org_id: A.orgId, customer_id: ctx.customer.id, professional_id: ctx.pro.id, customer_name: ctx.customer.name,
    professional_name: ctx.pro.name, status: "scheduled", booking_source: "salon", comanda_strategy: "new_on_arrival" };
  expectFail(await A.insert("appointments", { ...base, service_id: ctx.hair.id, service_name: "Corte QA", starts_at: start, ends_at: plusMinutes(start, 60), price: 150 }), "serviço não vinculado");
  ctx.appt = expectOk(await A.insert("appointments", { ...base, service_id: ctx.nails.id, service_name: "Manicure QA", starts_at: start, ends_at: plusMinutes(start, 45), price: 100 }), "agendamento")[0];
  expectFail(await A.insert("appointments", { ...base, service_id: ctx.nails.id, service_name: "Manicure QA", starts_at: plusMinutes(start, 15), ends_at: plusMinutes(start, 60), price: 100 }), "conflito", /horário/);
  ctx.base = base;
});

await step("4. Edita/reagenda o agendamento", async () => {
  const start = isoAt(3, 14);
  const row = expectOk(await A.update("appointments", "id=eq." + ctx.appt.id, { starts_at: start, ends_at: plusMinutes(start, 45), status: "confirmed" }), "reagendar")[0];
  assert.equal(row.status, "confirmed");
});

await step("5–6. Inicia atendimento e gera uma única Comanda (sem duplicar)", async () => {
  const first = expectOk(await A.rpc("start_appointment_service_order", { p_appointment_id: ctx.appt.id, p_existing_order_id: null, p_force_new: false }), "iniciar");
  const second = expectOk(await A.rpc("start_appointment_service_order", { p_appointment_id: ctx.appt.id, p_existing_order_id: null, p_force_new: false }), "iniciar de novo");
  ctx.orderId = first.order_id || first.service_order_id || first.id;
  assert.ok(ctx.orderId, "RPC deve retornar a comanda: " + JSON.stringify(first));
  assert.equal(second.order_id || second.service_order_id || second.id, ctx.orderId);
  const orders = expectOk(await A.select("service_orders", "select=id&appointment_id=eq." + ctx.appt.id), "comandas");
  assert.equal(orders.length, 1);
});

await step("7. Adiciona produto à Comanda; o total do item é recalculado pelo banco", async () => {
  const item = expectOk(await A.insert("service_order_items", { org_id: A.orgId, order_id: ctx.orderId, item_type: "product", product_id: ctx.product.id,
    professional_id: ctx.pro.id, description: "Esmalte QA", quantity: 2, unit_price: 50, discount: 0, total: 1 }), "item produto")[0];
  assert.equal(Number(item.total), 100, "total manipulado pelo cliente deve ser corrigido");
  const order = expectOk(await A.select("service_orders", "select=total,status&id=eq." + ctx.orderId), "comanda")[0];
  assert.equal(Number(order.total), 200);
});

await step("8. Recebimento exige Caixa aberto; pagamento parcial gera entrada no Caixa", async () => {
  expectFail(await A.rpc("register_service_order_payment", { p_order_id: ctx.orderId, p_amount: 80, p_payment_method: "pix" }), "sem caixa", /Caixa/);
  ctx.cash = expectOk(await A.rpc("open_cash_register", { p_org_id: A.orgId, p_opening_amount: 100 }), "abrir caixa");
  expectFail(await A.rpc("open_cash_register", { p_org_id: A.orgId, p_opening_amount: 0 }), "caixa duplicado");
  const pay = expectOk(await A.rpc("register_service_order_payment", { p_order_id: ctx.orderId, p_amount: 80, p_payment_method: "pix" }), "parcial");
  assert.equal(Number(pay.balance), 120);
});

await step("Bloqueia edição/remoção de itens e desconto após recebimento", async () => {
  const items = expectOk(await A.select("service_order_items", "select=id&order_id=eq." + ctx.orderId), "itens");
  const upd = await A.update("service_order_items", "id=eq." + items[0].id, { unit_price: 1 });
  assert.ok(!upd.ok || (upd.data || []).length === 0, "edição deveria falhar");
  const del = await A.remove("service_order_items", "id=eq." + items[0].id);
  assert.ok(!del.ok || (del.data || []).length === 0, "remoção deveria falhar");
  const st = await A.update("service_orders", "id=eq." + ctx.orderId, { status: "closed" });
  assert.ok(!st.ok, "mudança direta de status deveria falhar");
  expectFail(await A.rpc("register_service_order_payment", { p_order_id: ctx.orderId, p_amount: 500, p_payment_method: "cash" }), "pagamento acima do saldo", /saldo/);
});

await step("9. Pagamento final quita a Comanda e baixa o estoque", async () => {
  const pay = expectOk(await A.rpc("register_service_order_payment", { p_order_id: ctx.orderId, p_amount: 120, p_payment_method: "cash" }), "final");
  assert.equal(pay.closed, true);
  const order = expectOk(await A.select("service_orders", "select=status,sale_id&id=eq." + ctx.orderId), "comanda")[0];
  assert.equal(order.status, "closed");
  const product = expectOk(await A.select("products", "select=stock_quantity&id=eq." + ctx.product.id), "produto")[0];
  assert.equal(Number(product.stock_quantity), 8);
});

await step("10. Caixa registra uma entrada por recebimento", async () => {
  const moves = expectOk(await A.select("cash_movements", "select=amount,movement_type&service_order_id=eq." + ctx.orderId), "movimentos");
  assert.deepEqual(moves.map(m => Number(m.amount)).sort((a, b) => a - b), [80, 120]);
  assert.ok(moves.every(m => m.movement_type === "income"));
  expectFail(await A.insert("cash_movements", { org_id: A.orgId, movement_type: "income", description: "fraude", amount: 1 }), "lançamento direto");
});

await step("11. Comissões proporcionais aos recebimentos (40% sobre o serviço de R$ 100 = R$ 40; produto sem comissão por padrão)", async () => {
  const comm = expectOk(await A.select("commissions", "select=id,amount,status,rate&professional_id=eq." + ctx.pro.id), "comissões");
  const total = comm.reduce((s, c) => s + Number(c.amount), 0);
  assert.equal(Math.round(total * 100) / 100, 40);
  assert.ok(comm.length >= 2, "esperado um lançamento por recebimento");
  ctx.commissions = comm;
});

await step("12. Paga comissão com saída no Caixa e impede pagamento em duplicidade", async () => {
  const ids = ctx.commissions.map(c => c.id);
  const payout = expectOk(await A.rpc("pay_professional_commissions", { p_org_id: A.orgId, p_professional_id: ctx.pro.id, p_commission_ids: ids, p_payment_method: "pix", p_notes: "QA" }), "pagar");
  assert.ok(payout);
  expectFail(await A.rpc("pay_professional_commissions", { p_org_id: A.orgId, p_professional_id: ctx.pro.id, p_commission_ids: ids, p_payment_method: "pix", p_notes: "QA" }), "duplicidade");
  const out = expectOk(await A.select("cash_movements", "select=amount&category=eq.professional_commission&org_id=eq." + A.orgId), "saída");
  assert.equal(Number(out[0].amount), 40);
});

await step("13. Cancela Comanda com pagamento parcial e gera estorno no Caixa", async () => {
  const start = isoAt(4, 13);
  const appt = expectOk(await A.insert("appointments", { ...ctx.base, customer_id: ctx.customer2.id, customer_name: ctx.customer2.name, service_id: ctx.nails.id, service_name: "Manicure QA", starts_at: start, ends_at: plusMinutes(start, 45), price: 100 }), "agendamento 2")[0];
  const started = expectOk(await A.rpc("start_appointment_service_order", { p_appointment_id: appt.id, p_existing_order_id: null, p_force_new: false }), "iniciar 2");
  const orderId = started.order_id || started.service_order_id || started.id;
  expectOk(await A.rpc("register_service_order_payment", { p_order_id: orderId, p_amount: 30, p_payment_method: "debit_card" }), "parcial 2");
  expectFail(await A.rpc("cancel_service_order", { p_order_id: orderId, p_refund_payments: false }), "cancelar sem estorno", /estorno/);
  const res = expectOk(await A.rpc("cancel_service_order", { p_order_id: orderId, p_refund_payments: true }), "cancelar com estorno");
  assert.equal(Number(res.refunded_amount), 30);
  const refund = expectOk(await A.select("cash_movements", "select=amount,movement_type&category=eq.service_order_refund&service_order_id=eq." + orderId), "estorno");
  assert.equal(refund.length, 1); assert.equal(refund[0].movement_type, "expense");
  const comm = expectOk(await A.select("commissions", "select=status,service_order_payment_id&status=neq.paid&org_id=eq." + A.orgId), "comissões");
  assert.ok(comm.every(c => c.status === "cancelled"), "comissões da comanda cancelada devem ser canceladas");
  ctx.orderPartial = orderId;
});

await step("Devolução de Comanda quitada estorna o Caixa e devolve o estoque", async () => {
  const start = isoAt(5, 13);
  const appt = expectOk(await A.insert("appointments", { ...ctx.base, service_id: ctx.nails.id, service_name: "Manicure QA", starts_at: start, ends_at: plusMinutes(start, 45), price: 100 }), "agendamento 3")[0];
  const started = expectOk(await A.rpc("start_appointment_service_order", { p_appointment_id: appt.id, p_existing_order_id: null, p_force_new: true }), "iniciar 3");
  const orderId = started.order_id || started.service_order_id || started.id;
  expectOk(await A.insert("service_order_items", { org_id: A.orgId, order_id: orderId, item_type: "product", product_id: ctx.product.id, description: "Esmalte QA", quantity: 1, unit_price: 50, discount: 0, total: 50 }), "produto 3");
  const order = expectOk(await A.select("service_orders", "select=total&id=eq." + orderId), "total 3")[0];
  expectOk(await A.rpc("register_service_order_payment", { p_order_id: orderId, p_amount: Number(order.total), p_payment_method: "cash" }), "quitar 3");
  let stock = expectOk(await A.select("products", "select=stock_quantity&id=eq." + ctx.product.id), "estoque")[0];
  assert.equal(Number(stock.stock_quantity), 7);
  const res = expectOk(await A.rpc("refund_service_order", { p_order_id: orderId, p_return_stock: true, p_reason: "QA" }), "devolução");
  assert.equal(Number(res.refunded_amount), Number(order.total));
  stock = expectOk(await A.select("products", "select=stock_quantity&id=eq." + ctx.product.id), "estoque")[0];
  assert.equal(Number(stock.stock_quantity), 8);
  expectFail(await A.rpc("refund_service_order", { p_order_id: orderId, p_return_stock: true, p_reason: "QA" }), "devolução duplicada");
});

await step("Estoque: alteração direta bloqueada; ajuste rastreado permitido", async () => {
  const direct = await A.update("products", "id=eq." + ctx.product.id, { stock_quantity: 999 });
  assert.ok(!direct.ok, "alteração direta deveria falhar");
  const adj = expectOk(await A.rpc("adjust_product_stock", { p_product_id: ctx.product.id, p_movement_type: "in", p_quantity: 2, p_reason: "Compra QA", p_unit_cost: null }), "ajuste");
  assert.equal(Number(adj.stock_quantity), 10);
  expectFail(await A.rpc("adjust_product_stock", { p_product_id: ctx.product.id, p_movement_type: "out", p_quantity: 50, p_reason: "QA", p_unit_cost: null }), "estoque negativo");
});

await step("Caixa: lançamento manual e despesa paga pelo Caixa", async () => {
  expectOk(await A.rpc("register_cash_movement", { p_org_id: A.orgId, p_movement_type: "income", p_amount: 20, p_payment_method: "cash", p_category: "supply", p_description: "Suprimento QA" }), "suprimento");
  const exp = expectOk(await A.insert("expenses", { org_id: A.orgId, description: "Despesa QA", amount: 15, status: "pending" }), "despesa")[0];
  expectFail(await A.update("expenses", "id=eq." + exp.id, { status: "paid" }), "pagar despesa direto");
  expectOk(await A.rpc("pay_expense", { p_expense_id: exp.id, p_payment_method: "cash", p_use_cash: true }), "pagar despesa");
  expectFail(await A.rpc("pay_expense", { p_expense_id: exp.id, p_payment_method: "cash", p_use_cash: true }), "pagar duas vezes");
});

await step("Concorrência: dois pagamentos simultâneos do saldo total aceitam apenas um", async () => {
  const start = isoAt(6, 13);
  const appt = expectOk(await A.insert("appointments", { ...ctx.base, service_id: ctx.nails.id, service_name: "Manicure QA", starts_at: start, ends_at: plusMinutes(start, 45), price: 100 }), "agendamento 4")[0];
  const started = expectOk(await A.rpc("start_appointment_service_order", { p_appointment_id: appt.id, p_existing_order_id: null, p_force_new: true }), "iniciar 4");
  const orderId = started.order_id || started.service_order_id || started.id;
  const order = expectOk(await A.select("service_orders", "select=total&id=eq." + orderId), "total 4")[0];
  const args = { p_order_id: orderId, p_amount: Number(order.total), p_payment_method: "pix" };
  const [r1, r2] = await Promise.all([A.rpc("register_service_order_payment", args), A.rpc("register_service_order_payment", args)]);
  assert.equal([r1, r2].filter(r => r.ok).length, 1, "somente um pagamento pode ser aceito");
});

await step("Concorrência: fechamento do Caixa e pagamento simultâneo permanecem consistentes", async () => {
  const start = isoAt(7, 13);
  const appt = expectOk(await A.insert("appointments", { ...ctx.base, service_id: ctx.nails.id, service_name: "Manicure QA", starts_at: start, ends_at: plusMinutes(start, 45), price: 100 }), "agendamento 5")[0];
  const started = expectOk(await A.rpc("start_appointment_service_order", { p_appointment_id: appt.id, p_existing_order_id: null, p_force_new: true }), "iniciar 5");
  const orderId = started.order_id || started.service_order_id || started.id;
  const register = expectOk(await A.select("cash_registers", "select=id&status=eq.open&org_id=eq." + A.orgId), "caixa")[0];
  const [pay, close] = await Promise.all([
    A.rpc("register_service_order_payment", { p_order_id: orderId, p_amount: 10, p_payment_method: "cash" }),
    A.rpc("close_cash_register", { p_cash_register_id: register.id, p_closing_amount: 0 })
  ]);
  assert.ok(close.ok, "fechamento deve concluir: " + close.error);
  const moves = expectOk(await A.select("cash_movements", "select=amount,movement_type&cash_register_id=eq." + register.id), "movimentos");
  const closed = expectOk(await A.select("cash_registers", "select=opening_amount,expected_amount,closing_amount&id=eq." + register.id), "caixa fechado")[0];
  const net = moves.reduce((s, m) => s + (m.movement_type === "income" ? 1 : -1) * Number(m.amount), Number(closed.opening_amount));
  assert.equal(Math.round(net * 100) / 100, Number(closed.expected_amount), "saldo esperado deve incluir exatamente os movimentos gravados");
  if (pay.ok) assert.ok(moves.some(m => Number(m.amount) === 10), "pagamento aceito precisa estar no caixa fechado");
  assert.equal(Number(close.data.difference), Number((0 - Number(closed.expected_amount)).toFixed(2)));
});

await step("14. Orçamento criado e aceito não gera movimento financeiro nem comissão", async () => {
  const before = expectOk(await A.select("cash_movements", "select=id&org_id=eq." + A.orgId), "antes").length;
  const commBefore = expectOk(await A.select("commissions", "select=id&org_id=eq." + A.orgId), "antes c").length;
  const quote = expectOk(await A.rpc("create_quote_with_items", { p_org_id: A.orgId, p_branch_id: null, p_customer_id: ctx.customer.id, p_valid_until: null, p_notes: "QA",
    p_items: [{ service_id: ctx.nails.id, professional_id: ctx.pro.id, quantity: 1, discount_mode: "percent", discount_value: 0 }] }), "orçamento");
  expectOk(await A.update("quotes", "id=eq." + quote.id, { status: "accepted", accepted_at: new Date().toISOString() }), "aceitar");
  const items = expectOk(await A.select("quote_items", "select=id,duration_minutes,quantity&quote_id=eq." + quote.id), "itens orçamento");
  const start = isoAt(8, 13);
  expectOk(await A.rpc("create_quote_appointment_group", { p_quote_id: quote.id, p_items: items.map(i => ({ quote_item_id: i.id, professional_id: ctx.pro.id, starts_at: start, ends_at: plusMinutes(start, Number(i.duration_minutes) * Number(i.quantity)) })) }), "agendar orçamento");
  assert.equal(expectOk(await A.select("cash_movements", "select=id&org_id=eq." + A.orgId), "depois").length, before);
  assert.equal(expectOk(await A.select("commissions", "select=id&org_id=eq." + A.orgId), "depois c").length, commBefore);
});

await step("15. Isolamento: salão B não lê, altera nem opera dados do salão A", async () => {
  assert.equal(expectOk(await B.select("customers", "select=id&id=eq." + ctx.customer.id), "ler").length, 0);
  assert.equal(expectOk(await B.select("cash_movements", "select=id&org_id=eq." + A.orgId), "caixa").length, 0);
  assert.equal(expectOk(await B.select("commissions", "select=id&org_id=eq." + A.orgId), "comissões").length, 0);
  const upd = await B.update("customers", "id=eq." + ctx.customer.id, { name: "invadido" });
  assert.ok(!upd.ok || upd.data.length === 0, "B não pode alterar cliente de A");
  expectFail(await B.insert("customers", { org_id: A.orgId, name: "intruso", tags: [] }), "inserir em A");
  expectFail(await B.rpc("register_service_order_payment", { p_order_id: ctx.orderPartial, p_amount: 1, p_payment_method: "pix" }), "pagar comanda de A");
  expectFail(await B.rpc("open_cash_register", { p_org_id: A.orgId, p_opening_amount: 1 }), "abrir caixa de A");
  expectFail(await B.rpc("pay_professional_commissions", { p_org_id: A.orgId, p_professional_id: ctx.pro.id, p_commission_ids: [ctx.commissions[0].id], p_payment_method: "pix", p_notes: null }), "pagar comissão de A");
  const orgs = expectOk(await B.select("organizations", "select=id"), "orgs");
  assert.deepEqual(orgs.map(o => o.id), [B.orgId]);
});

await step("16. Profissional vê só a própria agenda e não acessa áreas administrativas/financeiras", async () => {
  const email = `qa-${RUN}-pro@salaopremium.test`;
  const user = expectOk(await admin.createUser(email, PASSWORD, { full_name: "Profissional QA", account_type: "professional" }), "conta profissional");
  created.users.push(user.id);
  expectOk(await admin.update("professionals", "id=eq." + ctx.pro.id, { profile_id: user.id, access_enabled: true }), "vincular perfil");
  expectOk(await admin.insert("org_memberships", { org_id: A.orgId, user_id: user.id, role: "professional", status: "active" }), "vínculo");
  const other = expectOk(await A.insert("professionals", { org_id: A.orgId, name: "Outra QA" }), "outro profissional")[0];
  expectOk(await A.insert("professional_services", { org_id: A.orgId, professional_id: other.id, service_id: ctx.hair.id }), "vínculo outro");
  const start = isoAt(3, 16);
  expectOk(await A.insert("appointments", { ...ctx.base, professional_id: other.id, professional_name: "Outra QA", service_id: ctx.hair.id, service_name: "Corte QA", starts_at: start, ends_at: plusMinutes(start, 60), price: 150 }), "agenda da outra");
  const P = await signIn(email, PASSWORD);
  const appts = expectOk(await P.select("appointments", "select=professional_id"), "agenda");
  assert.ok(appts.length > 0 && appts.every(a => a.professional_id === ctx.pro.id), "profissional deve ver apenas os próprios atendimentos");
  assert.equal(expectOk(await P.select("cash_movements", "select=id"), "caixa").length, 0);
  assert.equal(expectOk(await P.select("expenses", "select=id"), "despesas").length, 0);
  assert.equal(expectOk(await P.select("cash_registers", "select=id"), "caixas").length, 0);
  const comm = expectOk(await P.select("commissions", "select=professional_id"), "comissões");
  assert.ok(comm.every(c => c.professional_id === ctx.pro.id));
  expectFail(await P.rpc("open_cash_register", { p_org_id: A.orgId, p_opening_amount: 1 }), "abrir caixa");
  expectFail(await P.rpc("register_cash_movement", { p_org_id: A.orgId, p_movement_type: "income", p_amount: 1, p_payment_method: "cash", p_category: "supply", p_description: "x" }), "lançar caixa");
  expectFail(await P.insert("services", { org_id: A.orgId, name: "x", duration_minutes: 10, price: 1 }), "criar serviço");
  const settings = await P.update("organizations", "id=eq." + A.orgId, { name: "invadido" });
  assert.ok(!settings.ok || settings.data.length === 0, "profissional não pode alterar o salão");
});

await step("17. Matriz e filial: filial criada pelo proprietário e invisível a outro salão", async () => {
  const branch = expectOk(await A.insert("branches", { org_id: A.orgId, name: "Filial QA", is_main: false, address: {} }), "filial")[0];
  const all = expectOk(await A.select("branches", "select=id,is_main&org_id=eq." + A.orgId), "unidades");
  assert.equal(all.length, 2); assert.equal(all.filter(b => b.is_main).length, 1);
  assert.equal(expectOk(await B.select("branches", "select=id&id=eq." + branch.id), "B").length, 0);
  const c = expectOk(await A.insert("customers", { org_id: A.orgId, branch_id: branch.id, name: "Cliente filial QA", tags: [] }), "cliente filial")[0];
  assert.equal(c.branch_id, branch.id);
});

async function cleanup() {
  const failures = [];
  // IDs vêm exclusivamente das organizações/contas criadas por createOwner() neste processo.
  // Nunca usar filtros por nome, e-mail parcial ou padrões LIKE na limpeza.
  for (const orgId of created.orgs) {
    for (const table of ["audit_events", "recycle_bin"]) {
      const result = await admin.remove(table, "org_id=eq." + encodeURIComponent(orgId));
      if (!result.ok) failures.push(table + " / " + orgId + ": " + result.error);
    }
    const result = await admin.remove("organizations", "id=eq." + encodeURIComponent(orgId));
    if (!result.ok) failures.push("organizations / " + orgId + ": " + result.error);
  }
  for (const id of created.users) {
    const result = await admin.deleteUser(encodeURIComponent(id));
    if (!result.ok) failures.push("auth user / " + id + ": " + result.error);
  }
  if (failures.length) throw new Error("Falha na limpeza isolada dos dados de teste:\n" + failures.join("\n"));
}

if (KEEP) console.log("\nDados preservados (--keep). Organizações: " + created.orgs.join(", "));
else { await cleanup(); console.log("\nContas e dados de teste removidos."); }
const failed = results.filter(r => r[0] === "fail").length;
console.log("\nResultado: " + (results.length - failed) + "/" + results.length + " verificações aprovadas.");
process.exit(failed ? 1 : 0);