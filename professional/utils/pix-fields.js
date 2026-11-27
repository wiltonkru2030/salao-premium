/** Apresentação da chave Pix: a máscara depende do tipo escolhido. Não verifica titularidade. */
import {formatCpf,formatCnpj,formatPhone} from "../../src/utils/input-masks.js";
/** Configuração textual compartilhada pela view e pelo evento delegado de alteração. */
export function pixFieldConfig(type){
 return ({
  cpf:{mask:"cpf",inputMode:"numeric",placeholder:"000.000.000-00",maxLength:14},
  cnpj:{mask:"cnpj",inputMode:"numeric",placeholder:"00.000.000/0000-00",maxLength:18},
  phone:{mask:"phone",inputMode:"tel",placeholder:"(00) 00000-0000",maxLength:19},
  email:{mask:"none",inputMode:"email",placeholder:"nome@exemplo.com",maxLength:254},
  random:{mask:"none",inputMode:"text",placeholder:"Chave aleatória (UUID)",maxLength:36}
 })[type]||{mask:"none",inputMode:"text",placeholder:"Selecione o tipo de chave",maxLength:254};
}
/** Mostra DDD e telefone nacional, preservando chaves legadas fora do formato. */
export function displayPixKey(type,value){
 const raw=String(value??"");
 if(type==="cpf"&&/^\d{11}$/.test(raw))return formatCpf(raw);
 if(type==="cnpj"&&/^\d{14}$/.test(raw))return formatCnpj(raw);
 if(type==="phone"&&/^55\d{10,11}$/.test(raw))return formatPhone(raw.slice(2));
 return raw;
}
/** Troca de tipo exige nova entrada; evita reinterpretar uma chave anterior silenciosamente. */
export function updatePixField(form){
 const type=form.querySelector("[name=pixType]")?.value,input=form.querySelector("[name=pixKey]");
 if(!input)return;
 const config=pixFieldConfig(type);
 input.value="";input.dataset.mask=config.mask;input.inputMode=config.inputMode;
 input.placeholder=config.placeholder;input.maxLength=config.maxLength;input.disabled=!type;input.required=!!type;
}
