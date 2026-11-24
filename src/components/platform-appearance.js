/**
 * Preferência de aparência neste aparelho.
 * Compartilhada entre entradas que usam a paleta semântica do design system.
 */
const labels = {system: "Automática", light: "Clara", dark: "Escura"};

/**
 * Aplica a aparência, conserva a escolha local e acompanha mudanças do sistema.
 * @param {string} storageKey Chave de armazenamento da entrada.
 * @returns {{preference: string, set: Function}} Preferência atual e ação de alteração.
 */
export function createPlatformAppearance(storageKey) {
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  let preference = "system";
  try {
    const saved = localStorage.getItem(storageKey);
    if (Object.hasOwn(labels, saved)) preference = saved;
  } catch {
    // A aparência automática permanece disponível sem armazenamento local.
  }

  const apply = () => {
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.dataset.theme = preference === "system"
      ? (scheme.matches ? "dark" : "light")
      : preference;
  };
  scheme.addEventListener("change", apply);
  apply();

  return {
    get preference() { return preference; },
    set(next) {
      if (!Object.hasOwn(labels, next)) return;
      preference = next;
      apply();
      try { localStorage.setItem(storageKey, next); } catch { /* Mantém a escolha durante esta visita. */ }
    }
  };
}

/**
 * Renderiza a seleção de aparência.
 * @param {string} preference Preferência vigente. Os valores vêm da lista local.
 * @returns {string} Campo identificado para delegação do evento change.
 */
export function renderPlatformAppearance(preference = globalThis.document?.documentElement.dataset.themePreference ?? "system") {
  return '<label class="sp-appearance-control">Aparência<select data-platform-appearance>' +
    Object.entries(labels).map(([value, label]) =>
      '<option value="' + value + '"' + (value === preference ? ' selected' : '') + '>' + label + '</option>'
    ).join("") + '</select></label>';
}
