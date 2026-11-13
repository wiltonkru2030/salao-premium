/** Módulo Relatórios: apresenta indicadores e consultas de desempenho do tenant ativo. */
import { cardList } from './records.js';

// Página Relatórios: mantém sua rota isolada e reutiliza somente o componente de listagem.
export function reportsPage() {
  return cardList('Relatórios');
}
