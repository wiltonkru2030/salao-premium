import { cardList } from './records.js';

// Página Produtos e estoque: mantém sua rota isolada e reutiliza somente o componente de listagem.
export function productsPage() {
  return cardList('Produtos e estoque');
}
