/** Componente compartilhado de autocomplete. Responsabilidade: buscar, exibir, selecionar e limpar sugestões de campos. */
export function mountAutocomplete(input, { search, onSelect, getLabel = item => item?.name || "", minChars = 2, placeholder = "Nenhum resultado encontrado" } = {}) {
  if (!input || typeof search !== "function" || typeof onSelect !== "function") return () => {};
  const parent = input.parentElement;
  parent.classList.add("autocomplete-wrap");
  const menu = document.createElement("div");
  menu.className = "autocomplete-menu";
  menu.hidden = true;
  parent.append(menu);
  let timer = null, request = 0, active = -1, results = [];

  const close = () => { menu.hidden = true; menu.replaceChildren(); active = -1; };
  const choose = item => {
    input.value = getLabel(item);
    input.dataset.selectedId = item.id;
    close();
    onSelect(item);
  };
  const render = items => {
    results = Array.isArray(items) ? items : [];
    menu.replaceChildren();
    if (!results.length) {
      const empty = document.createElement("div");
      empty.className = "autocomplete-empty";
      empty.textContent = placeholder;
      menu.append(empty);
    } else {
      results.forEach((item, index) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "autocomplete-option";
        option.textContent = getLabel(item);
        option.setAttribute("role", "option");
        option.addEventListener("mousedown", event => event.preventDefault());
        option.addEventListener("click", () => choose(item));
        menu.append(option);
      });
    }
    menu.hidden = false;
  };
  const run = async value => {
    const current = ++request;
    try {
      const items = await search(value);
      if (current === request) render(items);
    } catch {
      if (current === request) render([]);
    }
  };
  const onInput = () => {
    delete input.dataset.selectedId;
    onSelect(null);
    clearTimeout(timer);
    const value = input.value.trim();
    if (value.length < minChars) { close(); return; }
    timer = setTimeout(() => run(value), 220);
  };
  const onKeydown = event => {
    if (menu.hidden || !results.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); active = (active + 1) % results.length; }
    else if (event.key === "ArrowUp") { event.preventDefault(); active = (active - 1 + results.length) % results.length; }
    else if (event.key === "Enter" && active >= 0) { event.preventDefault(); choose(results[active]); return; }
    else if (event.key === "Escape") { close(); return; }
    [...menu.children].forEach((node, index) => node.classList.toggle("active", index === active));
  };
  const onBlur = () => setTimeout(close, 120);
  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onKeydown);
  input.addEventListener("blur", onBlur);
  return () => {
    clearTimeout(timer);
    input.removeEventListener("input", onInput);
    input.removeEventListener("keydown", onKeydown);
    input.removeEventListener("blur", onBlur);
    menu.remove();
  };
}
