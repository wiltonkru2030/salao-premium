/**
 * Identificação visual do papel autenticado no painel.
 * Responsabilidade: explicar a sessão ativa sem derivar permissões de metadados.
 * A autorização real continua sendo validada pelo servidor e pelas políticas RLS.
 * @param {string|null} role Papel ativo obtido da associação à organização.
 * @returns {{label:string,limited:boolean}} Rótulo e aviso de navegação reduzida.
 */
export function describeAccessRole(role) {
  switch (role) {
    case "owner": return { label: "Proprietário · painel completo", limited: false };
    case "admin": return { label: "Administrador", limited: false };
    case "professional": return { label: "Profissional · acesso limitado", limited: true };
    case "receptionist": return { label: "Recepção", limited: false };
    default: return { label: "Conta conectada", limited: false };
  }
}
