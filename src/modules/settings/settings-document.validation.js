/**
 * Validação do documento cadastral de organização ou unidade.
 * Reutiliza os verificadores fiscais existentes antes de enviar alterações ao Supabase.
 */
import {validCpf} from "../professionals/professionals.validation.js";
import {validCnpj, normalizeCnpj} from "../../utils/cnpj.js";

/** Aceita campo opcional, CPF válido ou CNPJ numérico/alfanumérico válido. */
export function validSettingsDocument(value) {
  const input = String(value ?? "").trim();
  if (!input) return true;
  if (/^[\d.\s-]+$/.test(input) && input.replace(/\D/g, "").length === 11) return validCpf(input);
  return Boolean(normalizeCnpj(input)) && validCnpj(input);
}
