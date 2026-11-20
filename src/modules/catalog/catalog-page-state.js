/**
 * Estado isolado de uma página de catálogo do SALÃO PREMIUM.
 * Responsabilidade: rejeitar respostas atrasadas e fornecer a lista vigente
 * aos eventos delegados, sem compartilhar registros entre organizações.
 */

/**
 * Cria um estado independente por página e elemento de montagem.
 * @returns {object} Operações de início, confirmação e leitura.
 */
export function createCatalogPageState() {
  const snapshots=new WeakMap();

  /** Inicia uma requisição e invalida a anterior daquele elemento. */
  function begin(host,orgId) {
    const request={orgId,rows:null};
    snapshots.set(host,request);
    return request;
  }

  /** Confere montagem, organização e identidade da requisição. */
  function isCurrent(host,request,orgId) {
    return Boolean(host?.isConnected&&request&&request.orgId===orgId&&snapshots.get(host)===request);
  }

  /** Publica registros apenas se a requisição continua vigente. */
  function commit(host,request,orgId,rows) {
    if(!isCurrent(host,request,orgId)||!Array.isArray(rows))return false;
    request.rows=rows;
    return true;
  }

  /** Retorna o contexto vigente, ou null durante carga ou troca de tenant. */
  function current(host,orgId) {
    const request=snapshots.get(host);
    return isCurrent(host,request,orgId)&&Array.isArray(request.rows)?request:null;
  }

  return {begin,isCurrent,commit,current};
}
