/** Estrutura visual da Área da Cliente, independente da sessão e das consultas. */
import { renderPlatformMark } from "../../src/components/platform-mark.js";
/** Recebe a marcação de uma tela já renderizada e compõe o layout global. */
export function renderClientShell(page){
  return '<div class="client-app-shell">' +
      '<header class="app-header"><div class="client-brand compact-brand">' + renderPlatformMark() + '<div><strong>SALÃO PREMIUM</strong><small>ÁREA DA CLIENTE</small></div></div>' +
      '<button class="icon-button" data-action="profile" aria-label="Abrir perfil">○</button></header>' +
      '<div class="client-alert" data-notice role="status" hidden></div>' +
      '<main>' + page + '</main><div data-bottom-nav></div>' +
    '</div>';
}
