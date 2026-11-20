/**
 * Fallback de rota do painel administrativo.
 * Responsabilidade: impedir que páginas sem módulo implementado exibam registros demonstrativos.
 * Não faz: consultar ou alterar dados do salão.
 */
import { head } from "../utils.js";

/**
 * Renderiza aviso neutro para uma rota sem integração real.
 * @param {string} name Nome da rota solicitada.
 * @returns {string} Conteúdo informativo sem dados fictícios.
 */
export function cardList(name) {
  return head(name, "Este módulo ainda não possui integração operacional disponível.") +
    '<div class="empty-state"><b>Funcionalidade em implementação</b><small>Esta área será liberada quando consulta, permissões, gravação e testes estiverem concluídos. Nenhum dado demonstrativo é exibido.</small></div>';
}
