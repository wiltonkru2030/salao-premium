/** Coordena a inicialização da autenticação fora do bloqueio interno do Supabase. */
/** Recebe as dependências da sessão e agenda a verificação sem bloquear eventos Auth. */
export function startClientSession({subscribeToAuthChanges,getCurrentUser,signOut,getUserId,setSession,resetAccountState,getEpoch,isCurrent,requireCurrent,renderLogin,renderLoading,loadProfile,loadPublicSalons,loadFavorites,renderApp}){
/** Eventos Auth são síncronos. Consultas são agendadas fora do lock do Supabase. */

  renderLogin();
  subscribeToAuthChanges((session)=>{
    const id=session?.user?.id||null;
    if(id===getUserId()){setSession(session);return;}
    resetAccountState(id);setSession(session);
    if(!id){renderLogin();return;}
    const epoch=getEpoch();
    root.innerHTML='<main class="page-content"><div class="empty-state"><span class="spinner"></span><p>Verificando sua conta…</p></div></main>';
    setTimeout(async()=>{
      try{
        if(!isCurrent(epoch))return;
        const user=await getCurrentUser();
        requireCurrent(epoch);
        if(user?.id!==id)throw new Error("Sessão inválida.");
        await loadProfile();requireCurrent(epoch);
        await Promise.all([loadPublicSalons(),loadFavorites()]);requireCurrent(epoch);
        renderApp();
      }catch(error){
        if(!isCurrent(epoch))return;
        setSession(null);resetAccountState(null);
        renderLogin("Não foi possível verificar sua sessão. Entre novamente.");
        try{await signOut();}catch{console.warn("Não foi possível encerrar a sessão inválida.");}
      }
    },0);
  });
}
