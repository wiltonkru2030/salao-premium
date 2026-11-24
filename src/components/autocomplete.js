/**
 * Autocomplete compartilhado pela Agenda, Comanda, Comissões e App Profissional.
 * O componente controla sugestões e navegação. Cada tela fornece busca e seleção.
 */
let nextListId = 0;

/**
 * Monta uma caixa de pesquisa com espera de digitação e opções navegáveis.
 * @param {HTMLInputElement} input Campo usado para pesquisar e mostrar a seleção.
 * @param {object} options Busca, callback de seleção, rótulo e limite mínimo de busca.
 * @returns {Function} Remove listeners, sugestões e respostas pendentes.
 */
export function mountAutocomplete(input, {
  search, onSelect, getLabel = item => item?.name || "", minChars = 2,
  placeholder = "Nenhum resultado encontrado"
} = {}) {
  const parent = input?.parentElement;
  if (!parent || typeof search !== "function" || typeof onSelect !== "function") return () => {};

  const document = input.ownerDocument;
  const initialAttributes = new Map(
    ["role", "aria-controls", "aria-autocomplete", "aria-expanded", "aria-activedescendant"]
      .map(name => [name, input.getAttribute(name)])
  );
  const menu = document.createElement("div");
  const list = document.createElement("div");
  const status = document.createElement("div");

  parent.classList.add("autocomplete-wrap");
  menu.className = "autocomplete-menu";
  menu.hidden = true;
  list.id = "autocomplete-list-" + (++nextListId);
  list.setAttribute("role", "listbox");
  status.className = "autocomplete-empty";
  status.setAttribute("role", "status");
  status.hidden = true;
  menu.append(list, status);
  parent.append(menu);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");

  let timer;
  let request = 0;
  let active = -1;
  let results = [];

  const close = () => {
    clearTimeout(timer);
    request++;
    active = -1;
    results = [];
    menu.hidden = true;
    list.replaceChildren();
    status.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };

  const showStatus = message => {
    status.textContent = message;
    status.hidden = false;
    menu.hidden = false;
  };

  const choose = item => {
    input.value = getLabel(item);
    input.dataset.selectedId = item.id;
    close();
    onSelect(item);
  };

  const run = async (value, current) => {
    const isCurrent = () => current === request && input.isConnected &&
      !input.disabled && input.value.trim() === value;
    if (!isCurrent()) return;
    showStatus("Buscando…");
    try {
      const items = await search(value);
      if (!isCurrent()) return;
      if (!Array.isArray(items)) throw new TypeError("Resposta de busca inválida.");
      results = items.filter(item => item?.id != null);
      if (!results.length) {
        showStatus(placeholder);
        return;
      }

      status.hidden = true;
      results.forEach((item, index) => {
        const option = document.createElement("button");
        option.type = "button";
        option.tabIndex = -1;
        option.id = list.id + "-" + index;
        option.className = "autocomplete-option";
        option.textContent = getLabel(item);
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.addEventListener("mousedown", event => event.preventDefault());
        option.addEventListener("click", () => choose(item));
        list.append(option);
      });
      input.setAttribute("aria-expanded", "true");
    } catch {
      if (!isCurrent()) return;
      close();
      showStatus("Não foi possível buscar. Tente novamente.");
    }
  };

  const onInput = event => {
    close();
    delete input.dataset.selectedId;
    onSelect(null);
    const value = input.value.trim();
    if (event.isComposing || input.disabled || value.length < minChars) return;
    const current = request;
    timer = setTimeout(() => run(value, current), 220);
  };

  const onKeydown = event => {
    if (event.isComposing) return;
    if (event.key === "Escape") {
      if (!menu.hidden) event.preventDefault();
      close();
      return;
    }
    if (menu.hidden || !results.length) return;
    if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      choose(results[active]);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const increment = event.key === "ArrowDown" ? 1 : -1;
    active = active === -1 && increment === -1
      ? results.length - 1
      : (active + increment + results.length) % results.length;
    Array.from(list.children).forEach((node, index) => {
      node.classList.toggle("active", index === active);
      node.setAttribute("aria-selected", String(index === active));
    });
    const option = list.children[active];
    input.setAttribute("aria-activedescendant", option.id);
    option.scrollIntoView({block: "nearest"});
  };

  input.addEventListener("input", onInput);
  input.addEventListener("compositionend", onInput);
  input.addEventListener("keydown", onKeydown);
  input.addEventListener("blur", close);
  return () => {
    close();
    input.removeEventListener("input", onInput);
    input.removeEventListener("compositionend", onInput);
    input.removeEventListener("keydown", onKeydown);
    input.removeEventListener("blur", close);
    for (const [name, value] of initialAttributes) {
      if (value === null) input.removeAttribute(name);
      else input.setAttribute(name, value);
    }
    menu.remove();
  };
}
