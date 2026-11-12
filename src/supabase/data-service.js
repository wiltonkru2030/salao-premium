import { supabase } from './client.js';

const TABLES = new Set([
  'branches','customers','professionals','services','products','inventory_movements',
  'appointments','appointment_blocks','sales','sale_items','cash_registers',
  'cash_movements','expenses','commission_rules','commissions','app_settings',
  'notifications','audit_logs','service_orders','service_order_items'
]);

async function tenant() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Faça login para acessar os dados.');
  const { data, error } = await supabase.from('org_memberships')
    .select('org_id,role').eq('user_id', user.id).eq('status','active').limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Conta sem salão ativo.');
  return { user, ...data };
}

function assertTable(table) {
  if (!TABLES.has(table)) throw new Error('Tabela não permitida neste serviço.');
}

export async function listRecords(table, { columns='*', orderBy='created_at', ascending=false, limit=100, filters={} } = {}) {
  assertTable(table);
  const { org_id } = await tenant();
  let query = supabase.from(table).select(columns).eq('org_id', org_id);
  for (const [key,value] of Object.entries(filters)) query = value === null ? query.is(key,null) : query.eq(key,value);
  if (orderBy) query = query.order(orderBy,{ascending});
  if (limit) query = query.limit(Math.min(Math.max(Number(limit)||100,1),500));
  const { data,error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createRecord(table, values) {
  assertTable(table);
  const { org_id,user } = await tenant();
  const payload = { ...values, org_id };
  if ('created_by' in values || ['appointments','sales','expenses','cash_movements','inventory_movements','appointment_blocks'].includes(table)) payload.created_by = user.id;
  const { data,error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateRecord(table, id, values) {
  assertTable(table);
  const { org_id } = await tenant();
  const { org_id: ignoredOrg, id: ignoredId, created_at: ignoredCreated, ...safeValues } = values;
  const { data,error } = await supabase.from(table).update(safeValues).eq('id',id).eq('org_id',org_id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRecord(table, id) {
  assertTable(table);
  const { org_id } = await tenant();
  const { error } = await supabase.from(table).delete().eq('id',id).eq('org_id',org_id);
  if (error) throw error;
  return true;
}

export async function currentTenant() {
  return tenant();
}
