import { cardList } from './records.js';

// Página Equipe e permissões: mantém sua rota isolada e reutiliza somente o componente de listagem.
export function teamPage() {
  return cardList('Equipe e permissões');
}
