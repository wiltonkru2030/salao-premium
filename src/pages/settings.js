/**
 * Módulo: Configurações administrativas.
 * Responsabilidade: montar a navegação entre grupos de preferências atualmente demonstrativos.
 * Persistência: ainda não conectada ao Supabase neste módulo.
 */
import { state } from "../state.js";
import { config } from "../data/index.js";
import { head, esc } from "../utils.js";

export function settings() {
  const options = Object.keys(config);
  const selected = config[state.setting] ? state.setting : (options[0] || "Geral");
  state.setting = selected;

  let html = head("Configurações", "Centralize as preferências, regras e segurança do salão.");
  html += '<div class="settings-layout">';
  html += '<nav class="settings-nav" aria-label="Grupos de configurações">';
  html += options.map(option =>
    '<button type="button" class="' + (selected === option ? "active" : "") +
    '" data-setting="' + esc(option) + '">' + esc(option) + '<span>›</span></button>'
  ).join("");
  html += '</nav><section class="surface settings-panel">';
  html += '<div class="section-heading"><div><h2>' + esc(selected) +
    '</h2><p>Preferências da unidade · conteúdo demonstrativo</p></div></div>';
  html += (config[selected] || []).map(item =>
    '<button type="button" class="setting-row" data-setting-item="' + esc(item[0]) +
    '"><span>' + esc(item[0]) + '</span><b>' + esc(item[1]) + '</b></button>'
  ).join("");
  html += '<div class="settings-foot">As configurações serão persistidas quando o banco de dados estiver conectado.</div>';
  html += '</section></div>';
  return html;
}
