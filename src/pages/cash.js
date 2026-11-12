import { cardList } from './records.js';

// Página Caixa: mantém sua rota isolada e reutiliza somente o componente de listagem.
export function cashPage() {
  return cardList('Caixa');
}
