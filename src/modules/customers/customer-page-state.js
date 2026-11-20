/**
 * Estado da página de clientes do SALÃO PREMIUM, separado da interface.
 * Responsabilidade: isolar carregamentos por montagem e organização, sem manter dados
 * de uma sessão anterior nem permitir que uma resposta atrasada sobrescreva a atual.
 */

/**
 * Cria um controlador de estado por elemento de montagem.
 * @returns {object} Operações de início, confirmação e leitura do carregamento atual.
 */
export function createCustomerPageState() {
  const snapshots=new WeakMap();

  return {
    /**
     * Inicia uma leitura; substitui qualquer requisição anterior da mesma montagem.
     * @param {object} host Elemento da página.
     * @param {string} orgId Organização consultada.
     * @returns {object} Referência única da requisição.
     */
    begin(host,orgId) {
      const request={orgId,customers:null};
      snapshots.set(host,request);
      return request;
    },

    /**
     * Confirma se uma requisição ainda pertence à página e organização atuais.
     * @param {object} host Elemento da página.
     * @param {object} request Referência retornada por begin.
     * @param {string} orgId Organização ativa neste instante.
     * @returns {boolean} true apenas para a requisição vigente.
     */
    isCurrent(host,request,orgId) {
      return Boolean(host?.isConnected&&request&&request.orgId===orgId&&snapshots.get(host)===request);
    },

    /**
     * Publica a lista somente se a requisição continua vigente.
     * @param {object} host Elemento da página.
     * @param {object} request Referência da requisição.
     * @param {string} orgId Organização atualmente ativa.
     * @param {Array<object>} customers Lista recebida.
     * @returns {boolean} Indica se a resposta foi aceita.
     */
    commit(host,request,orgId,customers) {
      if(!this.isCurrent(host,request,orgId))return false;
      request.customers=customers;
      return true;
    },

    /**
     * Retorna a lista mais recente da montagem, se pertencente à organização atual.
     * @param {object} host Elemento da página.
     * @param {string} orgId Organização ativa.
     * @returns {object|null} Contexto com clientes, ou null durante carga/troca de organização.
     */
    current(host,orgId) {
      const snapshot=snapshots.get(host);
      return this.isCurrent(host,snapshot,orgId)&&Array.isArray(snapshot.customers)?snapshot:null;
    }
  };
}
