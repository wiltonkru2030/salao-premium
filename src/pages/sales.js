import { cardList } from './records.js';

// Página Vendas: mantém sua rota isolada e reutiliza somente o componente de listagem.
export function salesPage() {
  return cardList('Vendas');
}
