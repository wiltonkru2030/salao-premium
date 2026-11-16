/**
 * Escopo do catálogo de serviços.
 * Serviços sem filial são compartilhados pela organização; serviços com filial
 * só aparecem na matriz correspondente.
 */
export function scopeServiceCatalog(query, branchId) {
  return branchId
    ? query.or(`branch_id.is.null,branch_id.eq.${branchId}`)
    : query.is("branch_id", null);
}
