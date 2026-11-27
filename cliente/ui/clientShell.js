/** Estrutura visual da Área da Cliente, independente da sessão e das consultas. */
import { renderPlatformThemeToggle } from "../../src/components/platform-appearance.js";
import { renderPlatformMark } from "../../src/components/platform-mark.js";
/** Recebe a marcação de uma tela já renderizada e compõe o layout global. */
export function renderClientShell(page){
  return '<div class="client-app-shell">' +
      '<header class="app-header"><div class="client-brand compact-brand">' + renderPlatformMark() + '<div><strong>SALÃO PREMIUM</strong><small>ÁREA DA CLIENTE</small></div></div>' +
      renderPlatformThemeToggle() + '</header>' +
      '<div class="client-alert" data-notice role="status" hidden></div>' +
      '<main>' + page + '</main><div data-bottom-nav></div>' +
    '</div>';
}
