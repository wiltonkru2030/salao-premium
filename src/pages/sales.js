/** Módulo Vendas: apresenta registros comerciais vinculados à organização ativa. */
import { cardList } from './records.js';

// Página Vendas: mantém sua rota isolada e reutiliza somente o componente de listagem.
/** Renderiza a página de Vendas usando a listagem compartilhada; confirmar persistência real antes de uso comercial. */
export function salesPage() {
  return cardList('Vendas');
}
