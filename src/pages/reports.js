import { cardList } from './records.js';

// Página Relatórios: mantém sua rota isolada e reutiliza somente o componente de listagem.
export function reportsPage() {
  return cardList('Relatórios');
}
