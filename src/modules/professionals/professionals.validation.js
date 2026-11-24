/**
 * Validação fiscal de profissionais: normalização e dígitos verificadores.
 * Funções puras, sem DOM ou acesso ao banco.
 */
/** Remove caracteres não numéricos. */
export const onlyDigits=value=>String(value||"").replace(/\D/g,"");
/** Valida CPF pelos dígitos verificadores e rejeita sequências repetidas. */
export function validCpf(value){
 const cpf=onlyDigits(value);if(cpf.length!==11||/^([0-9])\1{10}$/.test(cpf))return false;
 const digit=(base,factor)=>{let sum=0;for(let i=0;i<base.length;i++)sum+=Number(base[i])*(factor-i);const rest=(sum*10)%11;return rest===10?0:rest;};
 return digit(cpf.slice(0,9),10)===Number(cpf[9])&&digit(cpf.slice(0,10),11)===Number(cpf[10]);
}
export {validCnpj} from "../../utils/cnpj.js";
