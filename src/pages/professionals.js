import { cardList } from './records.js';

// Página Profissionais: mantém sua rota isolada e reutiliza somente o componente de listagem.
export function professionalsPage() {
  return cardList('Profissionais');
}
