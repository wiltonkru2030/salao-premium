/**
 * Resolução do contexto local de Configurações.
 * Não altera a filial operacional da Agenda, Comanda ou Caixa.
 * Um profissional só enxerga sua unidade vinculada, como defesa visual adicional à RLS.
 *
 * @param {object} options Unidades retornadas pelo tenant, unidade escolhida na tela e filial operacional.
 * @returns {{units:Array<object>,selectedBranch:object|null}} Unidades visíveis e unidade administrativa selecionada.
 */
export function resolveSettingsBranch({units=[],selectedBranchId=null,operationalBranch=null,role=null}={}) {
  const source=Array.isArray(units)?units:[];
  const visible=role==="professional"
    ? source.filter(unit=>unit.active===true&&unit.id===operationalBranch?.id)
    : source;
  const selected=visible.find(unit=>unit.id===selectedBranchId)
    || (!operationalBranch?.isAll&&visible.find(unit=>unit.id===operationalBranch?.id))
    || visible.find(unit=>unit.is_main&&unit.active)
    || visible.find(unit=>unit.active)
    || visible[0]||null;
  return {units:visible,selectedBranch:selected};
}
