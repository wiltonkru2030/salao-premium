/**
 * Serviço de regras, configurações e repasses de comissão do SALÃO PREMIUM.
 * Responsabilidade: validar entradas e executar gravações financeiras por Supabase/RPC.
 * Segurança: exige org_id em todas as operações; RLS e RPCs do banco fazem a autorização final.
 */

/** Converte erros de banco em mensagens pt-BR sem expor SQL ou detalhes internos. */
function mapCommissionWriteError(error,context) {
  if(error?.code==="23505")return new Error("Já existe uma regra de comissão igual cadastrada.");
  if(error?.code==="23503")return new Error("O profissional, serviço ou registro selecionado não está mais disponível.");
  if(error?.code==="42501")return new Error("Seu perfil não tem permissão para alterar esta informação.");
  if(["PGRST202","PGRST205","42P01","42883"].includes(error?.code))return new Error("O recurso de comissões ainda não está disponível no banco.");
  return new Error(context||"Não foi possível concluir a operação de comissão.");
}

/** Valida contexto de organização e conexão antes de gravar dados. */
function requireWriteContext(client,orgId) {
  if(!client?.from||!client?.rpc)throw new TypeError("A conexão com o financeiro não está disponível.");
  if(typeof orgId!=="string"||!orgId.trim())throw new TypeError("A organização ativa não foi identificada.");
}

/** Valida a taxa percentual de uma regra entre 0 e 100. */
function validateRate(rate,{mustBePositive=false}={}) {
  const value=Number(rate);
  if(!Number.isFinite(value)||value<0||value>100||(mustBePositive&&value<=0)) {
    throw new TypeError("Informe um percentual válido entre 0 e 100.");
  }
  return value;
}

/**
 * Cria regra específica de comissão por profissional e serviço.
 * @param {object} options Cliente, organização, profissional, serviço e taxa.
 * @returns {Promise<void>} Resolve quando a regra é persistida.
 */
export async function createServiceCommissionRule({client,orgId,professionalId,serviceId,rate}={}) {
  requireWriteContext(client,orgId);
  if(!professionalId||!serviceId)throw new TypeError("Selecione o profissional e o serviço.");
  const normalizedRate=validateRate(rate);
  const {error}=await client.from("commission_rules").insert({
    org_id:orgId,professional_id:professionalId,service_id:serviceId,
    item_type:"service",rate:normalizedRate,active:true
  });
  if(error)throw mapCommissionWriteError(error,"Não foi possível cadastrar a regra de comissão.");
}

/**
 * Atualiza regra específica de comissão.
 * @param {object} options Cliente, organização, regra, profissional, serviço e taxa.
 * @returns {Promise<void>} Resolve após a atualização.
 */
export async function updateServiceCommissionRule({client,orgId,ruleId,professionalId,serviceId,rate}={}) {
  requireWriteContext(client,orgId);
  if(!ruleId||!professionalId||!serviceId)throw new TypeError("Selecione uma regra, profissional e serviço válidos.");
  const normalizedRate=validateRate(rate);
  const {error}=await client.from("commission_rules").update({
    professional_id:professionalId,service_id:serviceId,rate:normalizedRate
  }).eq("org_id",orgId).eq("id",ruleId);
  if(error)throw mapCommissionWriteError(error,"Não foi possível atualizar a regra de comissão.");
}

/**
 * Exclui regra específica, retornando o cálculo à taxa padrão do profissional.
 * @param {object} options Cliente, organização e identificador da regra.
 * @returns {Promise<void>} Resolve após a exclusão.
 */
export async function deleteServiceCommissionRule({client,orgId,ruleId}={}) {
  requireWriteContext(client,orgId);
  if(!ruleId)throw new TypeError("Selecione uma regra válida.");
  const {error}=await client.from("commission_rules").delete().eq("org_id",orgId).eq("id",ruleId);
  if(error)throw mapCommissionWriteError(error,"Não foi possível excluir a regra de comissão.");
}

/**
 * Salva a configuração global de comissão de produtos.
 * @param {object} options Cliente, organização, usuário, configuração existente e taxa.
 * @returns {Promise<void>} Resolve quando a configuração é criada ou atualizada.
 */
export async function saveProductCommissionSetting({
  client,orgId,settingId=null,userId=null,enabled=false,rate=0
}={}) {
  requireWriteContext(client,orgId);
  const normalizedRate=validateRate(rate,{mustBePositive:Boolean(enabled)});
  const payload={setting_value:{enabled:Boolean(enabled),default_rate:normalizedRate},updated_by:userId||null};
  const result=settingId
    ? await client.from("app_settings").update(payload).eq("org_id",orgId).eq("id",settingId)
    : await client.from("app_settings").insert({
        org_id:orgId,branch_id:null,setting_key:"product_commission",...payload
      });
  if(result.error)throw mapCommissionWriteError(result.error,"Não foi possível salvar a comissão de produtos.");
}

/**
 * Registra repasse de comissões por RPC transacional.
 * @param {object} options Cliente, organização, profissional, IDs e forma de pagamento.
 * @returns {Promise<object>} Resultado do repasse confirmado pelo servidor.
 * @throws {TypeError|Error} Quando os dados são inválidos ou o banco rejeita o repasse.
 */
export async function payProfessionalCommissions({
  client,orgId,professionalId,commissionIds,paymentMethod="pix",notes="Pagamento de comissões"
}={}) {
  requireWriteContext(client,orgId);
  if(!professionalId||!Array.isArray(commissionIds)||commissionIds.length===0||
     commissionIds.some(id=>typeof id!=="string"||!id.trim())) {
    throw new TypeError("Selecione o profissional e ao menos uma comissão para pagar.");
  }
  const {data,error}=await client.rpc("pay_professional_commissions",{
    p_org_id:orgId,p_professional_id:professionalId,
    p_commission_ids:[...new Set(commissionIds)],
    p_payment_method:String(paymentMethod||"").trim(),
    p_notes:String(notes||"").trim()||null
  });
  if(error)throw mapCommissionWriteError(error,"Não foi possível registrar o pagamento das comissões.");
  if(!data||typeof data!=="object"||!Number.isFinite(Number(data.amount))||Number(data.amount)<=0) {
    throw new Error("O servidor não confirmou um repasse válido.");
  }
  return data;
}
