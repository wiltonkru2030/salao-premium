/** Módulo Unidades: apresenta e gerencia filiais pertencentes à organização ativa. */
import { cardList } from './records.js';

// Página Unidades: mantém sua rota isolada e reutiliza somente o componente de listagem.
export function branchesPage() {
  return cardList('Unidades');
}
