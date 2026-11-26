/** Conecta as buscas de serviço e profissional ao formulário de itens do Orçamento. */
import {mountAutocomplete} from "../../../components/autocomplete.js";
import {findQuoteNamedOptions} from "../services/quote-customer-search.js";

/**
 * Monta pesquisas no catálogo autorizado carregado pela página.
 * A troca do serviço limpa o responsável e invalida pesquisas anteriores.
 * Retorna a função de descarte para o redesenho do formulário.
 */
export function mountQuoteItemSearch(host, {services, professionals, professionalServices}) {
  const serviceField = host.querySelector("#quote-service");
  const professionalField = host.querySelector("#quote-professional");
  const currency = new Intl.NumberFormat("pt-BR", {style: "currency", currency: "BRL"});
  let disposeProfessional = () => {};

  const disposeService = mountAutocomplete(serviceField, {
    search: term => findQuoteNamedOptions(services, term),
    getLabel: service => service.name + " · " + currency.format(service.price) + " · " + service.duration_minutes + " min",
    placeholder: "Serviço não encontrado",
    onSelect(service) {
      disposeProfessional();
      professionalField.value = "";
      delete professionalField.dataset.selectedId;
      professionalField.disabled = !service;
      professionalField.placeholder = service ? "Buscar profissional pelo nome" : "Selecione um serviço primeiro";
      if (!service) return;

      serviceField.value = service.name;
      const eligibleIds = new Set(professionalServices
        .filter(link => link.service_id === service.id)
        .map(link => link.professional_id));
      const eligible = professionals.filter(professional => eligibleIds.has(professional.id));
      disposeProfessional = mountAutocomplete(professionalField, {
        search: term => findQuoteNamedOptions(eligible, term),
        placeholder: "Nenhum profissional habilitado encontrado",
        onSelect() {}
      });
    }
  });

  return () => {
    disposeService();
    disposeProfessional();
  };
}
