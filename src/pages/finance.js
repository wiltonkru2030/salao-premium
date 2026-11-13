/** Módulo Financeiro: apresenta indicadores e movimentos financeiros consolidados da organização. */
import { cardList } from './records.js';

// Página Financeiro: mantém sua rota isolada e reutiliza somente o componente de listagem.
export function financePage() {
  return cardList('Financeiro');
}
