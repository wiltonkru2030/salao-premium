import { cardList } from './records.js';

// Página Comissões: mantém sua rota isolada e reutiliza somente o componente de listagem.
export function commissionsPage() {
  return cardList('Comissões');
}
