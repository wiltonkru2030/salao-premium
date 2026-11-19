/**
 * Formatação e rótulos do domínio Comanda.
 * Funções puras: não consultam banco, DOM ou estado de sessão.
 */

/** Formata valor numérico como moeda brasileira (BRL). */
export const currency=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
/** Traduz status internos da comanda para rótulos apresentados na interface. */
export const statusLabel=value=>({open:"Aberta",in_progress:"Em atendimento",awaiting_payment:"Aguardando pagamento",partially_paid:"Pagamento parcial",closed:"Finalizada",cancelled:"Cancelada"})[value]||"Status não identificado";
/** Traduz status interno de pagamento para rótulo em português. */
export const paymentStatusLabel=value=>({confirmed:"Confirmado",refunded:"Estornado",cancelled:"Cancelado"})[value]||"Em análise";
/** Traduz código da forma de pagamento para o nome exibido ao usuário. */
export const paymentMethodLabel=value=>({pix:"PIX",cash:"Dinheiro",credit_card:"Cartão de crédito",debit_card:"Cartão de débito",transfer:"Transferência",voucher:"Voucher",other:"Outro"})[value]||"Outro";
