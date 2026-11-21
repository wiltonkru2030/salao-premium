/** Módulo Profissionais: cadastro, dados fiscais, serviços habilitados e permissões vinculados ao tenant ativo. */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, toast } from "../utils.js";
import { bindProfessionalEvents } from "../modules/professionals/professionals.controller.js";
import { renderProfessionalsView } from "../modules/professionals/professionals.view.js";
import { reportError } from "../utils/errors.js";
import { fetchProfessionalWorkspace, setProfessionalActive, setTeamProfessionalAppAccess, revokeProfessionalAppAccess, createProfessionalWithServices, updateProfessionalProfile } from "../modules/professionals/professionals.service.js";

/** Módulo Profissionais: cadastro fiscal, vínculo de serviços e controle de acesso ao App Profissional. */

const initialPasswords=new Map();
let credentialContext=null;
let loadVersion=0;
/** Escrita em profissionais, vínculos e gestão de acesso exige owner/admin no banco. */
const canManageProfessionals=()=>["owner","admin"].includes(state.membership?.role);
/** Renderiza a página de Profissionais e o acesso ao cadastro e permissões. */
export function professionalsPage(){
 return head("Profissionais","Cadastre profissionais e gerencie o acesso individual por CPF ao App Profissional.")+
  '<p class="demo-note"><a href="../professional/index.html" target="_blank" rel="noopener">Abrir App Profissional ↗</a></p>'+
  '<div id="professionals-access"><div class="empty-state">Carregando profissionais…</div></div>';
}
/** Consulta profissionais e serviços habilitados da organização ativa. */
export async function loadProfessionalsPage(){
 const host=document.querySelector("#professionals-access");
 if(!host||!state.organization?.id)return;
 const orgId=state.organization.id,userId=state.user?.id;
 const version=++loadVersion;
 const branchId=state.branch?.id||null;
 const key=JSON.stringify([orgId,userId,state.membership?.role,branchId]);
 if(key!==credentialContext){initialPasswords.clear();credentialContext=key;}
 const isCurrent=()=>host.isConnected&&version===loadVersion&&state.organization?.id===orgId&&state.user?.id===userId&&JSON.stringify([orgId,userId,state.membership?.role,state.branch?.id||null])===key;
 host.textContent="Carregando profissionais…";
 let workspace;
 try {
  workspace=await fetchProfessionalWorkspace({
   client:supabase,orgId,currentUserId:userId,branchId
  });
  if(!isCurrent())return;
  host.innerHTML=renderProfessionalsView(workspace,{currentUserId:userId,canManage:canManageProfessionals(),initialPasswords});
 } catch(error) {
  if(!isCurrent())return;
  reportError(error,{context:"Profissionais > carregar cadastros"});
  host.innerHTML='<div class="empty-state">Não foi possível carregar os dados da equipe. Atualize a página e tente novamente.</div>';
  return;
 }
 bindProfessionalEvents({host,client:supabase,state,initialPasswords,canManageProfessionals,toast,reportError,setProfessionalActive,setTeamProfessionalAppAccess,revokeProfessionalAppAccess,createProfessionalWithServices,updateProfessionalProfile,workspace,loadProfessionalsPage});
}
