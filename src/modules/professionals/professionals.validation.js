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
/** Valida CNPJ numérico pelos dois dígitos verificadores. */
export function validCnpj(value){
 const cnpj=onlyDigits(value);if(cnpj.length!==14||/^([0-9])\1{13}$/.test(cnpj))return false;
 const calc=(base,weights)=>{const sum=base.split("").reduce((total,n,i)=>total+Number(n)*weights[i],0),rest=sum%11;return rest<2?0:11-rest;};
 const first=calc(cnpj.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2]);
 const second=calc(cnpj.slice(0,12)+first,[6,5,4,3,2,9,8,7,6,5,4,3,2]);
 return first===Number(cnpj[12])&&second===Number(cnpj[13]);
}
