/** Regras puras do extrato: filtros civis no fuso do salão e rótulos financeiros. */
import {summarizeProfessionalCommissions} from "./access.rules.js";

/** Converte o instante em dia civil do estabelecimento, sem depender do fuso do aparelho. */
export function commissionDateKey(value,timezone){
 const date=new Date(value);
 if(!value||!Number.isFinite(date.getTime()))return "";
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:timezone||"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
 const part=type=>parts.find(p=>p.type===type)?.value;
 return part("year")+"-"+part("month")+"-"+part("day");
}
/** Mantém o saldo global independente dos filtros; pagamentos usam a própria data de repasse. */
export function filterCommissionStatement(rows,payouts,filters={},timezone){
 const {from="",to="",status="all",type="all"}=filters;
 const within=value=>{const day=commissionDateKey(value,timezone);return !!day&&(!from||day>=from)&&(!to||day<=to);};
 const commissions=rows.filter(row=>within(row.created_at)&&(status==="all"||(status==="reversal"?Number(row.amount)<0&&row.status!=="cancelled":row.status===status))&&(type==="all"||row.item_type===type));
 const filteredPayouts=payouts.filter(row=>within(row.paid_at));
 return {commissions,payouts:filteredPayouts,global:summarizeProfessionalCommissions(rows,payouts),period:summarizeProfessionalCommissions(commissions,filteredPayouts)};
}
/** Traduz estados e métodos registrados; valores desconhecidos não vazam códigos técnicos. */
export const commissionStatusLabel=status=>({pending:"Pendente",approved:"Aprovada",paid:"Paga",cancelled:"Cancelada"})[status]||"Não informado";
export const commissionTypeLabel=type=>({service:"Serviço",product:"Produto"})[type]||"Comissão";
export const paymentMethodLabel=method=>({cash:"Dinheiro",pix:"Pix",credit_card:"Cartão de crédito",debit_card:"Cartão de débito",transfer:"Transferência",voucher:"Vale",other:"Outro"})[method]||"Não informado";
