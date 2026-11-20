/**
 * Módulo: Configurações administrativas.
 * Responsabilidade: consultar e editar dados reais da organização e da unidade selecionada.
 * Segurança: gravações limitadas a owner/admin pela interface e, principalmente, pelas políticas RLS.
 * Escopo: dados cadastrais e expediente têm persistência; notificações, cobrança e outras preferências seguem pendentes.
 */
import {bindSettingsEvents} from "../modules/settings/settings.controller.js";
import {resolveSettingsBranch} from "../modules/settings/settings.context.js";
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { reportError } from "../utils/errors.js";
import {renderSettingsView} from "../modules/settings/settings.view.js";
import {listAvailabilitySettings} from "../modules/availability/availability.service.js";
import { bindAvailabilitySettings } from "../modules/availability/availability-settings.view.js";


const canManageSettings = () => ["owner", "admin"].includes(state.membership?.role);

/** Renderiza a estrutura inicial; os dados reais são carregados sem recarregar a página. */
export function settings() {
  return head("Configurações", "Dados da organização e das unidades, com alterações protegidas por perfil.") +
    '<div id="settings-manager"><div class="empty-state">Carregando configurações…</div></div>';
}

/** Consulta organização e unidades sempre limitadas ao tenant autenticado. */
export async function loadSettingsPage() {
  const host = document.querySelector("#settings-manager");
  const orgId = state.organization?.id;
  if (!host || !orgId) return;

  const context=JSON.stringify([orgId,state.user?.id,state.membership?.role,state.branch?.id||null,state.branch?.isAll===true]);
  const request=String(Number(host.dataset.request||0)+1);host.dataset.request=request;
  const current=()=>host.isConnected&&state.page==="Configurações"&&host.dataset.request===request&&context===JSON.stringify([state.organization?.id,state.user?.id,state.membership?.role,state.branch?.id||null,state.branch?.isAll===true]);
  host._settingsContext=null;
  host.textContent="Carregando configurações…";
  try {
    const [{ data: organization, error: orgError }, { data: branches, error: branchError }] = await Promise.all([
      supabase.from("organizations")
        .select("id,name,document,phone,email,timezone,currency")
        .eq("id", orgId).maybeSingle(),
      supabase.from("branches")
        .select("id,name,phone,email,document,is_main,active")
        .eq("org_id", orgId)
        .order("is_main", { ascending: false })
        .order("name", { ascending: true })
        .limit(200)
    ]);
    if (orgError) throw orgError;
    if (branchError) throw branchError;
    if (!organization) throw new Error("Organização não encontrada.");

    // Seleção administrativa é independente da unidade operacional do cabeçalho.
    // A opção 'Todas as unidades' não deve ser transformada silenciosamente em Matriz.
    const {units,selectedBranch}=resolveSettingsBranch({
      units:branches||[],selectedBranchId:host.dataset.settingsBranchId||null,
      operationalBranch:state.branch,role:state.membership?.role
    });
    if(!current())return;
    host.dataset.settingsBranchId=selectedBranch?.id||"";
    const canManage = canManageSettings();
    let publicProfile = null;
    let branchPublicProfile = null;
    let publicDirectoryReady = true;
    // O perfil profissional não possui SELECT nas tabelas administrativas da vitrine pública.
    if (canManage) {
      try {
        const [profileResult, branchProfileResult] = await Promise.all([
          supabase.from("salon_public_profiles").select("*").eq("org_id", orgId).maybeSingle(),
          selectedBranch
            ? supabase.from("branch_public_profiles").select("*").eq("org_id", orgId).eq("branch_id", selectedBranch.id).maybeSingle()
            : Promise.resolve({data:null,error:null})
        ]);
        if (profileResult.error) throw profileResult.error;
        if (branchProfileResult.error) throw branchProfileResult.error;
        publicProfile = profileResult.data;
        branchPublicProfile = branchProfileResult.data;
      } catch (error) {
        if (["PGRST205", "42P01"].includes(error?.code)) publicDirectoryReady = false;
        else throw error;
      }
    }
    const availability = selectedBranch ? await listAvailabilitySettings(orgId, selectedBranch.id) : null;

    if(!current())return;
    host.innerHTML=renderSettingsView({organization,units,selectedBranch,canManage,publicProfile,branchPublicProfile,publicDirectoryReady,availability});
    host._settingsContext={context,units,orgId};

    bindAvailabilitySettings(host,{orgId,branchId:selectedBranch?.id,canManage,reload:loadSettingsPage});

    bindSettingsEvents({host,state,supabase,toast,reportError,canManageSettings,reload:loadSettingsPage});
  } catch (error) {
    if(!current())return;
    host._settingsContext=null;
    reportError(error, { context: "Configurações > carregar dados" });
    host.innerHTML = '<div class="empty-state"><b>Não foi possível carregar as configurações.</b><small>Verifique sua conexão e suas permissões. Tente novamente.</small></div>';
  }
}
