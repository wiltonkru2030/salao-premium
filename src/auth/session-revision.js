/**
 * Guarda de geração da sessão administrativa.
 * Responsabilidade: impedir que consultas de contexto iniciadas por uma conta
 * alterem a interface depois de logout ou troca de identidade.
 * Funções puras quanto ao navegador: não acessam Supabase, DOM ou armazenamento.
 */
export function createSessionRevision() {
  let revision = 0;
  let currentUserId = null;

  return {
    /**
     * Observa a identidade confirmada pelo evento de autenticação.
     * Um refresh de token do mesmo usuário preserva as consultas em andamento.
     * @returns {boolean} Verdadeiro quando a identidade realmente mudou.
     */
    observe(user) {
      const nextId = typeof user?.id === "string" && user.id.trim() ? user.id : null;
      if (nextId === currentUserId) return false;
      currentUserId = nextId;
      revision += 1;
      return true;
    },

    /** Invalida até consultas da mesma conta após um logout explícito. */
    invalidate() {
      currentUserId = null;
      revision += 1;
    },

    /** Marca a consulta com a versão da sessão que a iniciou. */
    capture(user) {
      return { revision, userId: user?.id || null };
    },

    /** Rejeita respostas cujo usuário ou versão não sejam mais atuais. */
    isCurrent(ticket) {
      return !!ticket && ticket.revision === revision && ticket.userId === currentUserId;
    }
  };
}
