/**
 * Componente: bottomNavigation.js
 * Responsabilidade: renderizar navegação principal e notificar a tela selecionada.
 * A navegação não concede permissões; cada página deverá consultar seu próprio serviço.
 */
const ITEMS = [
  { id: "home", label: "Início", icon: "⌂" },
  { id: "appointments", label: "Agendamentos", icon: "▣" },
  { id: "profile", label: "Perfil", icon: "○" }
];
export function renderBottomNavigation(active, onNavigate) {
  const nav = document.createElement("nav");
  nav.className = "client-bottom-nav";
  nav.setAttribute("aria-label", "Navegação principal");
  for (const item of ITEMS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `nav-item${active === item.id ? " active" : ""}`;
    button.setAttribute("aria-current", active === item.id ? "page" : "false");
    button.innerHTML = `<span aria-hidden="true">${item.icon}</span><small>${item.label}</small>`;
    button.addEventListener("click", () => onNavigate(item.id));
    nav.append(button);
  }
  return nav;
}
