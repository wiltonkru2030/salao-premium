/** Perfil e Configurações: componentes globais, campos protegidos e edição de preferências. */
import {renderPlatformAppearance} from "../../src/components/platform-appearance.js";
import {formatSavedPhone} from "../../src/utils/input-masks.js";
import {escapeHtml as esc} from "../utils/formatters.js";
const detail=(label,value)=>'<div class="detail-row"><span>'+esc(label)+'</span><b>'+esc(value||"Não informado")+'</b></div>';
/** Exibe dados do cadastro administrativo, sem mostrar a chave Pix na página inicial. */
export function profileView(state,{preferencesEnabled=false}={}){
 const p=state.profilePreferences||{},name=state.professional?.name||state.profile?.full_name||"Profissional";
 const initials=name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join("").toLocaleUpperCase("pt-BR");
 const photo=typeof p.photo_url==="string"&&/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?\/[^\s]*$/.test(p.photo_url)?p.photo_url:"";
 return '<section aria-labelledby="professional-profile-heading"><div class="section-title"><h2 id="professional-profile-heading">Meu perfil</h2></div><article class="detail sp-content-surface professional-settings-card">'+
 '<div class="professional-record-heading">'+(photo?'<img class="professional-initials" width="48" height="48" referrerpolicy="no-referrer" alt="Foto do perfil" src="'+esc(photo)+'">':'<span class="professional-initials" aria-hidden="true">'+esc(initials)+'</span>')+'<div class="record-main"><h3>'+esc(name)+'</h3><p class="meta">'+esc(p.specialty||state.professional?.specialty||"Profissional")+'</p></div></div>'+
 detail("Salão",state.organization?.name)+detail("Unidade",p.unit_name||"Consulte o salão")+detail("Telefone",formatSavedPhone(state.professional?.phone||state.profile?.phone||""))+detail("E-mail de contato",p.email||state.professional?.email)+
 '<p class="muted">Nome, telefone e vínculo são mantidos pelo salão.</p>'+
 (preferencesEnabled&&state.profilePreferencesStatus==="error"?'<p role="alert">Preferências indisponíveis.</p><button class="btn secondary" data-action="refresh-professional-profile">Tentar novamente</button>':"")+
 '<button type="button" class="btn primary" data-page="Configurações">Configurações</button></article></section>';
}
/** Formulário de dados editáveis. Preferências não representam inscrição em notificações push. */
function preferencesView(state){
 if(state.profilePreferencesStatus==="error")return '<section class="detail sp-content-surface"><p role="alert">Não foi possível carregar suas preferências.</p><button class="btn secondary" data-action="refresh-professional-profile">Tentar novamente</button></section>';
 if(state.profilePreferencesStatus!=="ready")return '<p role="status">Carregando preferências...</p>';
 const p=state.profilePreferences;
 const types=[["","Sem chave"],["cpf","CPF"],["cnpj","CNPJ"],["phone","Telefone com DDD"],["email","E-mail"],["random","Chave aleatória"]];
 return '<section class="detail sp-content-surface professional-settings-card"><h3>Dados de contato e preferências</h3><form id="professional-profile-preferences">'+
 '<label class="sp-labeled-field">E-mail de contato<input name="email" type="email" maxlength="254" autocomplete="email" value="'+esc(p.email||"")+'"></label><p class="muted">Não altera o login por CPF.</p>'+
 '<label class="sp-labeled-field">Endereço da foto (HTTPS)<input name="photoUrl" type="url" maxlength="2048" value="'+esc(p.photo_url||"")+'"></label>'+
 '<label class="sp-labeled-field">Tipo de chave Pix<select name="pixType">'+types.map(([value,label])=>'<option value="'+value+'"'+((p.pix_type||"")===value?' selected':'')+'>'+label+'</option>').join("")+'</select></label>'+
 '<label class="sp-labeled-field">Chave Pix<input name="pixKey" maxlength="254" autocomplete="off" value="'+esc(p.pix_key||"")+'"></label><p class="muted">Chave declarada, não verificada. Não autoriza transferências. Para remover, selecione Sem chave e apague o campo.</p>'+
 '<h3>Preferências de notificações</h3><label><input type="checkbox" name="notifyAgenda"'+(p.notify_agenda?' checked':'')+'> Agenda e atendimentos</label><label><input type="checkbox" name="notifyCommissions"'+(p.notify_commissions?' checked':'')+'> Comissões e repasses</label><p class="muted">Preferências salvas. Envio de notificações depende da configuração do serviço.</p>'+
 '<p role="alert" data-profile-preferences-error hidden></p><button class="btn primary" type="submit">Salvar preferências</button></form></section>';
}
/** Mantém configurações dentro do Perfil e exige confirmação da nova senha. */
export function settingsView(state,appearance,{preferencesEnabled=false}={}){
 const name=state.profile?.full_name||state.professional?.name||"";
 return '<button type="button" class="btn secondary" data-page="Perfil">← Voltar ao perfil</button><div class="section-title"><h2>Configurações</h2></div>'+
 '<section class="detail sp-content-surface professional-settings-card"><h3>Minha conta</h3>'+detail("Salão",state.organization?.name)+detail("Permissão",state.scope==="all"?"Acesso completo":state.scope==="calendar_all"?"Agenda completa":"Somente seus dados")+
 (state.role==="professional"?'<p class="muted">Nome e telefone são atualizados pelo salão.</p>':'<label class="sp-labeled-field">Nome<input id="profile-name" value="'+esc(name)+'" maxlength="120"></label><label class="sp-labeled-field">Telefone<input id="profile-phone" data-mask="phone" value="'+esc(state.profile?.phone||"")+'" inputmode="tel"></label><button class="btn primary" data-action="save-profile">Salvar perfil</button>')+'</section>'+
 (preferencesEnabled&&state.role==="professional"?preferencesView(state):"")+
 '<section class="detail sp-content-surface professional-settings-card"><h3>Segurança</h3><label class="sp-labeled-field">Nova senha<input id="settings-password" type="password" minlength="10" autocomplete="new-password"></label><label class="sp-labeled-field">Confirmar nova senha<input id="settings-password-confirm" type="password" minlength="10" autocomplete="new-password"></label><button type="button" class="btn secondary" data-action="change-password">Atualizar senha</button><p class="muted">A redefinição de senha também pode ser feita pelo administrador.</p></section>'+
 '<section class="detail sp-content-surface professional-settings-card">'+renderPlatformAppearance(appearance)+'</section><button type="button" class="btn secondary" data-action="logout">Sair da conta</button>';
}
