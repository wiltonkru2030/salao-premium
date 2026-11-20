/**
 * Serviço de acesso profissional: encapsula a função remota de provisionamento.
 * Não manipula DOM, não registra CPF ou senha e não expõe erros do servidor.
 */
import {validCpf,onlyDigits} from "./professionals.validation.js";
/**
 * Solicita criação ou redefinição de acesso.
 * @param {object} options Cliente autenticado, organização, profissional, ação e CPF.
 * @returns {Promise<object>} Resposta de sucesso ou falha do servidor.
 * @throws {Error} Entrada inválida ou falha de transporte.
 */
export async function requestProfessionalAccess({client,orgId,professionalId,action,cpf}) {
 if(!client?.functions?.invoke||!orgId||!professionalId||!["create","reset"].includes(action)||!validCpf(cpf))throw new Error("Dados de acesso profissional inválidos.");
 return client.functions.invoke("manage-professional-access",{body:{action,org_id:orgId,professional_id:professionalId,cpf:onlyDigits(cpf)}});
}
