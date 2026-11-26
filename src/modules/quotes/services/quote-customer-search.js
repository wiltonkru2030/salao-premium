/** Pesquisa local de clientes do Orçamento a partir do catálogo autorizado da unidade. */

/**
 * Procura nomes sem distinguir acentos ou caixa e telefones pela sequência de dígitos.
 * Recebe os clientes já carregados para o tenant e retorna até oito registros com seus IDs.
 */
export function findQuoteCustomers(customers, term) {
  const normalizedTerm = normalizeName(term);
  if (normalizedTerm.length < 2) return [];
  const phoneTerm = /^[+()\d\s-]+$/.test(normalizedTerm)
    ? normalizedTerm.replace(/\D/g, "")
    : "";
  return customers.filter(customer =>
    normalizeName(customer.name).includes(normalizedTerm) ||
    (phoneTerm.length >= 2 && String(customer.phone || "").replace(/\D/g, "").includes(phoneTerm))
  ).slice(0, 8);
}

/** Normaliza o texto para comparar uma busca com nomes cadastrados em pt-BR. */
function normalizeName(value) {
  return String(value || "").trim().normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
}

/**
 * Retorna até oito opções de catálogo cujo nome corresponde à busca.
 * Aceita nomes com ou sem acento e preserva os identificadores dos registros.
 */
export function findQuoteNamedOptions(options, term) {
  const normalizedTerm = normalizeName(term);
  if (normalizedTerm.length < 2) return [];
  return options.filter(option => normalizeName(option.name).includes(normalizedTerm)).slice(0, 8);
}
