/** Vincula as pesquisas do modal ao autocomplete compartilhado do sistema. */
import {mountAutocomplete} from "../src/components/autocomplete.js";
import {getProfessionalBookingClients} from "./views/booking.views.js";

/** Normaliza texto e acentuação para comparar os resultados de pesquisa. */
function normalized(value) {
  return String(value ?? "").normalize("NFD").replace(/\p{M}/gu,"").toLocaleLowerCase("pt-BR").trim();
}

/** Monta as buscas uma vez por formulário e mantém a seleção por identificador. */
export function bindProfessionalBookingSearch(form, state) {
  if (!form || form.dataset.searchBound || !state.professional) return;
  form.dataset.searchBound = "true";
  const clients = getProfessionalBookingClients({
    appointments:state.appointments, professional:state.professional, timezone:state.organization?.timezone
  });
  mountAutocomplete(form.querySelector("[data-booking-client]"), {
    search(term) {
      const name = normalized(term);
      const digits = /^[+()\d\s-]+$/.test(term) ? term.replace(/\D/g,"") : "";
      return clients.filter(client => normalized(client.name).includes(name) ||
        (digits.length >= 2 && String(client.phone || "").replace(/\D/g,"").includes(digits))).slice(0,8);
    },
    getLabel:client=>client.label,
    placeholder:"Nenhum cliente encontrado neste mês",
    onSelect() {}
  });
  mountAutocomplete(form.querySelector("[data-booking-service]"), {
    search:term=>state.services.filter(service=>normalized(service.name).includes(normalized(term))).slice(0,8),
    getLabel:service=>service.name+" · "+service.duration_minutes+" min",
    placeholder:"Nenhum serviço vinculado encontrado",
    onSelect() {}
  });
}
