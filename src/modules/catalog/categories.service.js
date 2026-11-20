/**
 * Serviço de categorias do catálogo do SALÃO PREMIUM.
 * Responsabilidade: listar categorias e administrar criação, renomeação e inativação.
 * Segurança: leitura por membros da organização; gravação por RPC owner/admin.
 */
const PAGE_SIZE=250;

/** Converte erros PostgREST em mensagens pt-BR sem expor SQL. */
function mapCategoryError(error) {
  let message="Não foi possível concluir a operação de categorias.";
  if(error?.code==="23505")message="Já existe uma categoria com esse nome neste catálogo.";
  else if(error?.code==="42501")message="Somente proprietário ou administrador pode alterar categorias.";
  else if(["PGRST202","PGRST205","42P01","42883"].includes(error?.code))message="O módulo de categorias ainda não foi ativado no banco.";
  const mapped=new Error(message);
  mapped.code=error?.code||null;
  return mapped;
}

/** Valida cliente e organização para consultas do catálogo. */
function requireContext(client,orgId) {
  if(!client?.from||!client?.rpc)throw new TypeError("A conexão com o catálogo não está disponível.");
  if(typeof orgId!=="string"||!orgId.trim())throw new TypeError("A organização ativa não foi identificada.");
}

/**
 * Lista categorias de serviço/produto com paginação.
 * @param {object} options Cliente, organização, tipo opcional e filtro de ativos.
 * @returns {Promise<Array<object>>} Categorias disponíveis no tenant.
 */
export async function listCatalogCategories({
  client,orgId,categoryType=null,activeOnly=false
}={}) {
  requireContext(client,orgId);
  if(categoryType!==null&&!["service","product"].includes(categoryType))throw new TypeError("Tipo de categoria inválido.");
  const rows=[];
  try {
    for(let offset=0;;offset+=PAGE_SIZE) {
      let query=client.from("catalog_categories")
        .select("id,org_id,category_type,name,active,created_at,updated_at")
        .eq("org_id",orgId);
      if(categoryType)query=query.eq("category_type",categoryType);
      if(activeOnly)query=query.eq("active",true);
      const {data,error}=await query.order("name").range(offset,offset+PAGE_SIZE-1);
      if(error)throw error;
      const page=Array.isArray(data)?data:[];
      rows.push(...page);
      if(page.length<PAGE_SIZE)break;
    }
    return rows;
  } catch(error) { throw mapCategoryError(error); }
}

/**
 * Cria ou renomeia uma categoria pelo RPC transacional.
 * @param {object} options Cliente, organização, tipo, nome e ID opcional.
 * @returns {Promise<string>} Identificador da categoria salva.
 */
export async function saveCatalogCategory({client,orgId,categoryId=null,categoryType,name}={}) {
  requireContext(client,orgId);
  const cleanName=String(name??"").trim();
  if(!["service","product"].includes(categoryType)||cleanName.length<2||cleanName.length>80) {
    throw new TypeError("Informe um tipo e nome de categoria válido (2 a 80 caracteres).");
  }
  const {data,error}=await client.rpc("save_catalog_category",{
    p_org_id:orgId,p_category_id:categoryId||null,p_category_type:categoryType,p_name:cleanName
  });
  if(error)throw mapCategoryError(error);
  if(typeof data!=="string"||!data)throw new Error("O servidor não confirmou a categoria.");
  return data;
}

/**
 * Ativa ou inativa categoria sem apagar a classificação dos itens existentes.
 * @param {object} options Cliente, organização, categoria e estado desejado.
 * @returns {Promise<boolean>} true quando a categoria foi atualizada.
 */
export async function setCatalogCategoryActive({client,orgId,categoryId,active}={}) {
  requireContext(client,orgId);
  if(!categoryId||typeof active!=="boolean")throw new TypeError("Selecione uma categoria e situação válidas.");
  const {data,error}=await client.rpc("set_catalog_category_active",{
    p_org_id:orgId,p_category_id:categoryId,p_active:active
  });
  if(error)throw mapCategoryError(error);
  return data===true;
}
