/**
 * Símbolo oficial do SALÃO PREMIUM, compartilhado pelas três entradas web.
 * O Vite resolve o arquivo da identidade visual para o caminho do build.
 */
const markUrl = new URL("../../brand/identidade-visual/logo/1_20261111_222414_0000.webp", import.meta.url);

/**
 * Retorna o símbolo decorativo para uso junto ao nome visível da plataforma.
 * @returns {string} Imagem quadrada com dimensões reservadas no layout.
 */
export function renderPlatformMark() {
  return '<img class="sp-platform-mark brand-logo" src="' + markUrl.href + '" width="44" height="44" alt="">';
}
