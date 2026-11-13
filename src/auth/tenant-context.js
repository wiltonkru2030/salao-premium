/**
 * Regras puras de seleção do tenant ativo.
 * Não consulta banco, não lê estado global e não confia em metadados editáveis.
 */

/**
 * @param {Array<{org_id:string,role:string,status:string}>} memberships
 * @param {Array<{id:string,name:string,timezone?:string,currency?:string}>} organizations
 * @param {string|null} selectedOrgId
 */
export function resolveTenantMemberships(memberships, organizations, selectedOrgId = null) {
  const organizationMap = new Map((organizations || []).map(item => [item.id, item]));
  const availableOrganizations = (memberships || [])
    .filter(item => item.status === "active")
    .map(membership => ({ ...membership, organization: organizationMap.get(membership.org_id) }))
    .filter(item => item.organization)
    .map(item => ({ id: item.org_id, name: item.organization.name, role: item.role }));

  if (!availableOrganizations.length) {
    throw new Error("Não foi possível localizar uma organização vinculada à sua conta.");
  }
  if (!selectedOrgId && availableOrganizations.length > 1) {
    return { requiresOrganizationSelection: true, organizations: availableOrganizations };
  }
  const selected = availableOrganizations.find(item => item.id === selectedOrgId)
    || (availableOrganizations.length === 1 ? availableOrganizations[0] : null);
  if (!selected) throw new Error("Selecione uma organização válida para continuar.");
  return {
    requiresOrganizationSelection: false,
    membership: memberships.find(item => item.org_id === selected.id && item.status === "active"),
    organization: organizationMap.get(selected.id),
    availableOrganizations
  };
}
