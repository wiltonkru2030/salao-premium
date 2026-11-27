/** Saudação e aparência do cabeçalho, usando o fuso do salão. */
import {syncPlatformThemeToggle,togglePlatformTheme} from "../../src/components/platform-appearance.js";
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
 syncPlatformThemeToggle(root.ownerDocument);
}
/** Alterna o tema efetivo e persiste a escolha pelo controlador global. */
export function toggleProfessionalTheme(root,state,appearance){
 togglePlatformTheme(appearance,root.ownerDocument);
 syncProfessionalHeader(root,state);
}
