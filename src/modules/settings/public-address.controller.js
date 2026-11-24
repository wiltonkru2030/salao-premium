/**
 * Preenchimento opcional da vitrine pública por CEP.
 * Envia apenas o CEP ao ViaCEP e conserva os campos manuais do formulário.
 */
const addressFields = {
  public_address: "logradouro", neighborhood: "bairro", city: "localidade", state: "uf"
};
const postalCode = value => {
  const code = String(value ?? "").trim();
  return /^\d{5}-?\d{3}$/.test(code) ? code.replace("-", "") : "";
};

/**
 * Consulta um CEP e converte os campos públicos para o formato da vitrine.
 * @param {string} value CEP com ou sem hífen.
 * @param {object} options Sinal de cancelamento e cliente HTTP.
 * @returns {Promise<object|null>} Endereço parcial, ou null se não encontrado.
 */
export async function lookupPublicAddress(value, {signal, request = fetch} = {}) {
  const code = postalCode(value);
  if (!code) throw new TypeError("Informe os oito dígitos do CEP.");
  const response = await request("https://viacep.com.br/ws/" + code + "/json/", {
    signal, referrerPolicy: "no-referrer"
  });
  if (!response.ok) throw new Error("Consulta de CEP indisponível.");
  const data = await response.json();
  if (data?.erro === true || data?.erro === "true") return null;
  if (!data || typeof data.localidade !== "string" || !data.localidade.trim() || !/^[A-Z]{2}$/.test(data.uf)) {
    throw new Error("Resposta de CEP inválida.");
  }
  return Object.fromEntries(Object.entries(addressFields).map(([field, key]) => [
    field, typeof data[key] === "string" ? data[key].trim() : ""
  ]));
}

/**
 * Vincula a busca aos eventos do formulário da vitrine.
 * @param {HTMLElement} host Área de configurações com formulários substituíveis.
 * @param {Function} active Verifica se o contexto de organização e usuário segue ativo.
 */
export function bindPublicAddressLookup(host, active) {
  const forms = new WeakMap();

  async function search(form, manual = false) {
    if (!active(form)) return;
    const status = form.querySelector("[data-postal-status]");
    const input = form.elements.postal_code;
    if (!status || !input) return;

    const previous = forms.get(form);
    previous?.request.abort();
    const request = new AbortController();
    const draft = {request, autofill: previous?.autofill || {}, edited: new Set()};
    forms.set(form, draft);
    const code = postalCode(input.value);
    if (!code) {
      status.textContent = manual ? "Informe os oito dígitos do CEP." : "";
      return;
    }

    const current = () => form.isConnected && active(form) &&
      forms.get(form) === draft && postalCode(input.value) === code;
    status.textContent = "Consultando CEP…";
    const timeout = setTimeout(() => request.abort(), 6000);
    try {
      const address = await lookupPublicAddress(code, {signal: request.signal});
      if (!current()) return;
      if (!address) {
        status.textContent = "CEP não encontrado. Preencha o endereço manualmente.";
        return;
      }
      for (const [name, value] of Object.entries(address)) {
        const field = form.elements[name];
        if (!field || draft.edited.has(name) || (field.value.trim() && field.value !== draft.autofill[name])) continue;
        field.value = value.slice(0, field.maxLength > 0 ? field.maxLength : undefined);
        draft.autofill[name] = field.value;
      }
      status.textContent = "Confira o endereço e complete o número e o complemento, se necessário.";
    } catch {
      if (current()) status.textContent = "Não foi possível consultar o CEP. Preencha o endereço manualmente.";
    } finally {
      clearTimeout(timeout);
    }
  }

  host.addEventListener("input", event => {
    if (event.target.matches("#public-profile-form [name=postal_code]") && !event.isComposing) {
      void search(event.target.form);
    } else if (Object.hasOwn(addressFields, event.target.name)) {
      const draft = forms.get(event.target.form);
      if (draft) {
        draft.edited.add(event.target.name);
        delete draft.autofill[event.target.name];
      }
    }
  });
  host.addEventListener("click", event => {
    const button = event.target.closest("#public-profile-form [data-postal-lookup]");
    if (button) void search(button.form, true);
  });
}
