/** Regras puras de escopo e navegação. A autorização definitiva permanece no RLS/RPC. */
export function resolveProfessionalContexts(memberships, professionals) {
 const activeProfiles=new Map(professionals.filter(p=>p.active===true&&p.access_enabled===true).map(p=>[p.org_id,p]));
 return memberships.filter(m=>m.status==="active").flatMap(m=>{
  const professional=activeProfiles.get(m.org_id)||null;
  const scope=m.role==="professional"?(professional?"self":"none"):m.professional_app_enabled===true&&["self","calendar_all","all"].includes(m.professional_app_scope)?m.professional_app_scope:"none";
  if(scope==="none"||(scope==="self"&&!professional))return [];
  return [{orgId:m.org_id,role:m.role,scope,professional}];
 });
}
/** Recepção com agenda completa não acessa módulos financeiros no app. */
export function allowedProfessionalPages(context) {
 if(!context||!["self","calendar_all","all"].includes(context.scope))return [];
 const pages=["Agenda"];
 if(context.scope!=="calendar_all")pages.push("Comandas");
 if(context.professional&&context.scope!=="calendar_all")pages.push("Comissões");
 if(context.role==="professional"&&context.professional)pages.push("Serviços");
 return [...pages,"Configurações"];
}
/** Permite registrar serviço apenas quando o próprio profissional e a comanda estão elegíveis. */
export function canRegisterProfessionalService(context,order) {
 return context?.scope==="self"&&context.role==="professional"&&!!context.professional&&["open","in_progress"].includes(order?.status);
}
/** Extrato em centavos; cancelamentos não compõem o saldo, débitos aparecem separadamente. */
export function summarizeProfessionalCommissions(rows,payouts) {
 const cents=value=>{const amount=Number(value);if(value==null||value===""||!Number.isFinite(amount)||!Number.isSafeInteger(Math.round(amount*100))||Math.abs(amount*100-Math.round(amount*100))>0.00001)throw new Error("O extrato contém um valor financeiro inválido. Atualize os dados ou contate o salão.");return Math.round(amount*100);};
 let credit=0,debit=0,paid=0;
 if(!Array.isArray(rows)||!Array.isArray(payouts))throw new Error("O extrato de comissões está indisponível.");
 for(const row of rows){
  const amount=cents(row.amount);
  if(row.status==="paid")paid+=amount;
  if(["pending","approved"].includes(row.status)){if(amount>=0)credit+=amount;else debit-=amount;}
 }
 const received=payouts.reduce((sum,p)=>sum+cents(p.amount),0);
 return {credit:credit/100,debit:debit/100,open:(credit-debit)/100,paid:paid/100,received:received/100};
}
