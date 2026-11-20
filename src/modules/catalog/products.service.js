/**
 * Serviço de catálogo e estoque de produtos do SALÃO PREMIUM.
 * Responsabilidade: listar, cadastrar, editar e inativar produtos por organização.
 * Segurança: todas as operações exigem org_id; RLS limita gravações a owner/admin.
 */
const PAGE_SIZE=250;

/** Converte erros PostgREST em mensagens pt-BR sem expor SQL. */
function mapProductError(error) {
  if(error?.code==="23505")return new Error("Já existe um produto com esse SKU ou identificação.");
  if(error?.code==="42501")return new Error("Seu perfil não tem permissão para alterar produtos.");
  if(["PGRST205","42P01"].includes(error?.code))return new Error("O catálogo de produtos ainda não está disponível no banco.");
  return new Error("Não foi possível concluir a operação de produtos.");
}

/** Valida conexão e organização antes de acessar o catálogo. */
function requireContext(client,orgId) {
  if(!client?.from)throw new TypeError("A conexão com o catálogo não está disponível.");
  if(typeof orgId!=="string"||!orgId.trim())throw new TypeError("A organização ativa não foi identificada.");
}

/**
 * Consulta todas as páginas de produtos do tenant.
 * @param {object} options Cliente Supabase e organização.
 * @returns {Promise<Array<object>>} Produtos ativos e inativos com dados de estoque.
 */
export async function listProducts({client,orgId}={}) {
  requireContext(client,orgId);
  const rows=[];
  try {
    for(let offset=0;;offset+=PAGE_SIZE) {
      const {data,error}=await client.from("products")
        .select("id,name,sku,category,cost_price,sale_price,stock_quantity,min_stock,active")
        .eq("org_id",orgId).order("name").range(offset,offset+PAGE_SIZE-1);
      if(error)throw error;
      const page=Array.isArray(data)?data:[];
      rows.push(...page);
      if(page.length<PAGE_SIZE)break;
    }
    return rows;
  } catch(error) { throw mapProductError(error); }
}

/**
 * Cadastra ou atualiza produto e seus valores de estoque.
 * @param {object} options Dados do produto e identificador opcional para edição.
 * @returns {Promise<void>} Resolve após persistir o produto.
 */
export async function saveProduct({
  client,orgId,productId=null,name,sku=null,category=null,
  costPrice,salePrice,stockQuantity=0,minStock=0
}={}) {
  requireContext(client,orgId);
  const cleanName=String(name??"").trim();
  const cost=Number(costPrice),sale=Number(salePrice),stock=Number(stockQuantity),minimum=Number(minStock);
  if(cleanName.length<2||cleanName.length>120)throw new TypeError("Informe um nome de produto entre 2 e 120 caracteres.");
  if(![cost,sale,stock,minimum].every(Number.isFinite)||[cost,sale,stock,minimum].some(value=>value<0)) {
    throw new TypeError("Custo, preço e quantidades não podem ser negativos.");
  }
  const cleanSku=String(sku??"").trim();
  if(cleanSku.length>64)throw new TypeError("O SKU deve ter até 64 caracteres.");
  const payload={
    name:cleanName,sku:cleanSku||null,category:String(category??"").trim()||null,
    cost_price:cost,sale_price:sale,min_stock:minimum
  };
  // Estoque existente só muda por movimentação; cadastro novo recebe o saldo inicial.
  try {
    const result=productId
      ? await client.from("products").update(payload).eq("org_id",orgId).eq("id",productId)
      : await client.from("products").insert({org_id:orgId,...payload,stock_quantity:stock,active:true});
    if(result.error)throw result.error;
  } catch(error) { throw mapProductError(error); }
}

/**
 * Ativa ou inativa produto sem excluir movimentações de estoque e vendas.
 * @param {object} options Cliente, organização, produto e estado desejado.
 * @returns {Promise<void>} Resolve após atualizar o estado.
 */
export async function setProductActive({client,orgId,productId,active}={}) {
  requireContext(client,orgId);
  if(!productId||typeof active!=="boolean")throw new TypeError("Selecione um produto e um estado válidos.");
  try {
    const {error}=await client.from("products").update({active}).eq("org_id",orgId).eq("id",productId);
    if(error)throw error;
  } catch(error) { throw mapProductError(error); }
}
