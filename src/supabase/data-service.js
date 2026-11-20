/**
 * Serviços de persistência compartilhados.
 * Responsabilidade: concentrar operações CRUD permitidas e limitar consultas ao tenant ativo.
 * Segurança: a filtragem no cliente complementa, mas nunca substitui RLS e validações no banco.
 */
import { supabase } from './client.js';

/** Lista de tabelas que esta camada genérica está autorizada a consultar ou alterar. */
const TABLES = new Set([
  'branches','customers','professionals','services','products','inventory_movements',
  'appointments','appointment_blocks','sales','sale_items','cash_registers',
  'cash_movements','expenses','commission_rules','commissions','app_settings',
  'notifications','audit_logs','service_orders','service_order_items'
]);

/** Resolve usuário autenticado e associação ativa; interrompe operações sem tenant válido. */
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

/** Bloqueia nomes de tabela fora da allowlist desta camada de persistência. */
function assertTable(table) {
  if (!TABLES.has(table)) throw new Error('Tabela não permitida neste serviço.');
}

/**
 * Lista registros da organização autenticada com filtros simples e limite máximo de 500.
 * @param {string} table Tabela autorizada pela allowlist.
 * @param {{columns?: string, orderBy?: string, ascending?: boolean, limit?: number, filters?: object}} options Opções de consulta.
 * @returns {Promise<object[]>} Registros retornados pelo Supabase.
 * @throws {Error} Quando não há sessão, tenant válido ou a consulta falha.
 */
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

/**
 * Cria registro e define organização e autor a partir da sessão autenticada.
 * @param {string} table Tabela autorizada pela allowlist.
 * @param {object} values Campos do registro, sem poder sobrescrever org_id definido pela sessão.
 * @returns {Promise<object>} Registro criado pelo Supabase.
 * @throws {Error} Quando a sessão, tenant ou inserção falha.
 */
export async function createRecord(table, values) {
  assertTable(table);
  const { org_id,user } = await tenant();
  const payload = { ...values, org_id };
  if ('created_by' in values || ['appointments','sales','expenses','cash_movements','inventory_movements','appointment_blocks'].includes(table)) payload.created_by = user.id;
  const { data,error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

/**
 * Atualiza registro pertencente à organização ativa, removendo campos de identidade imutáveis.
 * @param {string} table Tabela autorizada pela allowlist.
 * @param {string} id Identificador do registro.
 * @param {object} values Campos que podem ser atualizados.
 * @returns {Promise<object>} Registro atualizado.
 * @throws {Error} Quando não existe registro acessível ou a operação falha.
 */
export async function updateRecord(table, id, values) {
  assertTable(table);
  const { org_id } = await tenant();
  const { org_id: ignoredOrg, id: ignoredId, created_at: ignoredCreated, ...safeValues } = values;
  const { data,error } = await supabase.from(table).update(safeValues).eq('id',id).eq('org_id',org_id).select().single();
  if (error) throw error;
  return data;
}

/**
 * Exclui registro da organização ativa; a política de banco decide se a operação é permitida.
 * @param {string} table Tabela autorizada pela allowlist.
 * @param {string} id Identificador do registro.
 * @returns {Promise<true>} Confirmação de exclusão sem retorno de dados pessoais.
 * @throws {Error} Quando não existe registro acessível ou a exclusão falha.
 */
export async function deleteRecord(table, id) {
  assertTable(table);
  const { org_id } = await tenant();
  const { error } = await supabase.from(table).delete().eq('id',id).eq('org_id',org_id);
  if (error) throw error;
  return true;
}

/** Retorna contexto autenticado e tenant ativo para fluxos que precisam de dados de sessão. */
export async function currentTenant() {
  return tenant();
}
