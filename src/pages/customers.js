import { cardList } from './records.js';

// Página Clientes: mantém sua rota isolada e reutiliza somente o componente de listagem.
export function customersPage() {
  return cardList('Clientes');
}
