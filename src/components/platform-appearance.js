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

  /** Resolve o tema efetivo e atualiza os atributos usados pelo CSS. */
  const apply = () => {
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.dataset.theme = preference === "system"
      ? (scheme.matches ? "dark" : "light")
      : preference;
    syncPlatformThemeToggle(document);
  };
  scheme.addEventListener("change", apply);
  apply();

  return {
    /** Retorna a escolha original, inclusive quando segue o dispositivo. */
    get preference() { return preference; },
    /** Aplica uma preferência conhecida e tenta gravá-la neste aparelho. */
    set(next) {
      if (!Object.hasOwn(labels, next)) return;
      preference = next;
      apply();
      try { localStorage.setItem(storageKey, next); } catch { /* Mantém a escolha durante esta visita. */ }
    }
  };
}

/** Inverte o tema efetivo, inclusive quando a preferência original segue o sistema. */
export function nextPlatformTheme(theme){
  return theme==="dark"?"light":"dark";
}

/** Rótulos e estado acessível acompanham o tema sem reconstruir o conteúdo da página. */
export function syncPlatformThemeToggle(doc=globalThis.document){
  if(!doc)return;
  const dark=doc.documentElement.dataset.theme==="dark";
  const label=dark?"Ativar modo claro":"Ativar modo escuro";
  for(const button of doc.querySelectorAll("[data-platform-theme-toggle]")){
    button.setAttribute("aria-label",label);button.title=label;
    button.setAttribute("aria-pressed",String(dark));
  }
}

/** Único componente SVG de alternância, reservado aos cabeçalhos autenticados. */
export function renderPlatformThemeToggle(theme=globalThis.document?.documentElement.dataset.theme){
  const dark=theme==="dark",label=dark?"Ativar modo claro":"Ativar modo escuro";
  return '<button type="button" class="sp-theme-toggle" data-platform-theme-toggle data-action="toggle-platform-theme" aria-label="'+label+'" title="'+label+'" aria-pressed="'+String(dark)+'">'+
    '<svg class="sp-theme-moon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 14.2A8.8 8.8 0 0 1 9.8 3.2 8.8 8.8 0 1 0 20.8 14.2Z"/></svg>'+
    '<svg class="sp-theme-sun" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg></button>';
}

/** Atualiza preferência local usando o controlador da entrada atual, sem renderizar outra vez. */
export function togglePlatformTheme(appearance,doc=globalThis.document){
  appearance.set(nextPlatformTheme(doc.documentElement.dataset.theme));
  syncPlatformThemeToggle(doc);
}
