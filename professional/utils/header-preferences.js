/** Saudação e aparência do cabeçalho, usando o fuso do salão. */
import {salonTimezone} from "./salon-time.js";
/** Manhã antes de 12h, tarde antes de 18h e noite a partir de 18h. */
export function professionalGreeting(instant=new Date(),timezone){
 const hour=Number(new Intl.DateTimeFormat("pt-BR",{timeZone:salonTimezone(timezone),hour:"2-digit",hourCycle:"h23"}).format(instant));
 return hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite";
}
/** Atualiza somente o cabeçalho, preservando formulários e navegação. */
export function syncProfessionalHeader(root,state,instant=new Date()){
 const greeting=root.querySelector("[data-professional-greeting]");
 if(greeting)greeting.textContent=professionalGreeting(instant,state.organization?.timezone);
 const button=root.querySelector("[data-action=toggle-professional-theme]");
 if(button){
  const dark=root.ownerDocument.documentElement.dataset.theme==="dark",label=dark?"Ativar modo claro":"Ativar modo escuro";
  button.setAttribute("aria-label",label);button.title=label;button.setAttribute("aria-pressed",String(dark));
 }
}
/** Alterna o tema efetivo e persiste a escolha pelo controlador global. */
export function toggleProfessionalTheme(root,state,appearance){
 appearance.set(root.ownerDocument.documentElement.dataset.theme==="dark"?"light":"dark");
 const select=root.querySelector("[data-platform-appearance]");if(select)select.value=appearance.preference;
 syncProfessionalHeader(root,state);
}
