import { cardList } from './records.js';

// Página Serviços: mantém sua rota isolada e reutiliza somente o componente de listagem.
export function servicesPage() {
  return cardList('Serviços');
}
