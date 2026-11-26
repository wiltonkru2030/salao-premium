/** Resolve os ícones oficiais para as URLs publicadas pelo Vite. */
import {glyph} from "../data/index.js";

// O Vite inclui no build os SVGs oficiais usados nas rotas do painel.
const navigationAssets = import.meta.glob([
  '../../brand/identidade-visual/icones/Dashboard_20261112_105847_0000.svg',
  '../../brand/identidade-visual/icones/Agenda_20261112_105847_0001.svg',
  '../../brand/identidade-visual/icones/Clientes_20261112_105848_0006.svg',
  '../../brand/identidade-visual/icones/Profissionais_20261112_105848_0007.svg',
  '../../brand/identidade-visual/icones/Serviços_20261112_105849_0020.svg',
  '../../brand/identidade-visual/icones/Estoque_20261112_105849_0022.svg',
  '../../brand/identidade-visual/icones/Documentos_20261112_105850_0039.svg',
  '../../brand/identidade-visual/icones/Vendas_20261112_105849_0019.svg',
  '../../brand/identidade-visual/icones/Caixa_20261112_105848_0012.svg',
  '../../brand/identidade-visual/icones/Financeiro_20261112_105848_0011.svg',
  '../../brand/identidade-visual/icones/Comissões_20261112_105849_0027.svg',
  '../../brand/identidade-visual/icones/Relatórios_20261112_105850_0032.svg',
  '../../brand/identidade-visual/icones/Equipe_20261112_105848_0008.svg',
  '../../brand/identidade-visual/icones/Configurações_20261112_105850_0036.svg'
], {
  eager: true, query: '?url', import: 'default'
});

/** Retorna o SVG de um item reconhecido no catálogo de navegação. */
export function navigationIcon(page) {
  return navigationAssets['../../brand/identidade-visual/icones/' + glyph[page]] || "";
}
