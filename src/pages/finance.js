/** Módulo Financeiro: apresenta indicadores e movimentos financeiros consolidados da organização. */
import { cardList } from './records.js';

// Página Financeiro: mantém sua rota isolada e reutiliza somente o componente de listagem.
/** Renderiza a página Financeiro reutilizando a listagem compartilhada; verificar persistência antes de uso comercial. */
export function financePage() {
  return cardList('Financeiro');
}
