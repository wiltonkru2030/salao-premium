/** Módulo Relatórios: apresenta indicadores e consultas de desempenho do tenant ativo. */
import { cardList } from './records.js';

// Página Relatórios: mantém sua rota isolada e reutiliza somente o componente de listagem.
/** Renderiza a página de Relatórios usando a listagem compartilhada; confirmar fonte real dos indicadores. */
export function reportsPage() {
  return cardList('Relatórios');
}
