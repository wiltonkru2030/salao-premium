/** Controlador de eventos delegados da Área da Cliente. Não executa consultas nem renderiza telas. */
/** Encaminha cliques e formulários ao coordenador de ações. Retorna função de limpeza. */
export function bindClientEvents(root,runAction){
 if(!root?.addEventListener||typeof runAction!=="function")throw new TypeError("Controlador da cliente inválido.");
/** Intercepta envio do fallback de cidade e encaminha o evento ao serviço de preferências. */
const submit=event=>{
  const locationForm = event.target.closest("[data-location-form]");
  const profileForm = event.target.closest("[data-profile-form]");
  const salonSearchForm = event.target.closest("[data-salon-search]");
  if (!locationForm && !profileForm && !salonSearchForm) return;
  event.preventDefault();
  if (profileForm) runAction("save-profile", profileForm.querySelector('button[type="submit"]'));
  else if (salonSearchForm) runAction("search-salons", salonSearchForm.querySelector('button[type="submit"]'));
  else runAction("save-location", locationForm.querySelector('button[type="submit"]'));
};

/** Centraliza os cliques das telas sem registrar listeners a cada renderização. */
const click=event=>{
  const button = event.target.closest("[data-action]");
  if (button&&!button.disabled) runAction(button.dataset.action, button);
};


 root.addEventListener("submit",submit);
 root.addEventListener("click",click);
 return ()=>{root.removeEventListener("submit",submit);root.removeEventListener("click",click);};
}
