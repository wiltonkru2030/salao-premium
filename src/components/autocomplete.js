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
  placeholder = "Nenhum resultado encontrado", rich = false,
  getPrimary = getLabel, getSecondary = () => "", onEmptyAction = null,
  emptyActionLabel = "Cadastrar cliente"
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
  // Modo rico é opcional: demais telas preservam seu contrato atual.
  const emptyAction = Symbol("emptyAction");
  let searchIcon=null;
  if(rich){
    parent.classList.add("autocomplete-rich");
    searchIcon=document.createElement("span");searchIcon.className="autocomplete-search-icon";searchIcon.setAttribute("aria-hidden","true");
    searchIcon.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.3 4.3"/></svg>';
    parent.insertBefore(searchIcon,input);
  }
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
    if(item[emptyAction]){const term=item.term;close();onEmptyAction(term);return;}
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
        // A ação aparece exclusivamente após uma busca concluída sem resultados.
        // Falha de rede, busca pendente e busca curta nunca autorizam esse atalho.
        if(typeof onEmptyAction!=="function")return;
        results=[{[emptyAction]:true,term:value}];
      } else status.hidden = true;
      results.forEach((item, index) => {
        const option = document.createElement("button");
        option.type = "button";
        option.tabIndex = -1;
        option.id = list.id + "-" + index;
        option.className = "autocomplete-option";
        if(item[emptyAction]){
          option.classList.add("autocomplete-create");
          const icon=document.createElement("span");icon.className="autocomplete-result-icon";icon.setAttribute("aria-hidden","true");icon.textContent="+";
          const title=document.createElement("span");title.textContent=emptyActionLabel;option.append(icon,title);
        }else if(rich){
          const body=document.createElement("span");body.className="autocomplete-result-body";
          const title=document.createElement("span");title.className="autocomplete-result-title";title.textContent=getPrimary(item);body.append(title);
          const detail=getSecondary(item);if(detail){const sub=document.createElement("small");sub.className="autocomplete-result-detail";sub.textContent=detail;body.append(sub);}
          const arrow=document.createElement("span");arrow.className="autocomplete-result-arrow";arrow.setAttribute("aria-hidden","true");arrow.textContent="›";option.append(body,arrow);
        }else option.textContent = getLabel(item);
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        // Mantém a sugestão na tela até o clique, inclusive quando o teclado móvel está aberto.
        option.addEventListener("pointerdown", event => {
          if (event.isPrimary && event.button === 0) event.preventDefault();
        });
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
    if (event.key === "Enter" && (active >= 0 || (results.length===1 && results[0][emptyAction]))) {
      event.preventDefault();
      choose(results[active>=0?active:0]);
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
    menu.remove();searchIcon?.remove();if(rich)parent.classList.remove("autocomplete-rich");
  };
}
