/** Regras de agregação dos indicadores mensais. */
import {sumFinanceAmounts} from "../finance/finance-pagination.js";
/** Calcula indicadores sem misturar recebimentos e movimentos de caixa. */
export function calculateReportIndicators({payments,refunds,movements,closedOrders,orders,appointments,commissions,paidCommissions}){
    const sum=sumFinanceAmounts;
    const received=sum(payments,row=>["confirmed","refunded"].includes(row.status));
    const refunded=sum(refunds);
    const cashIn=sum(movements,row=>row.movement_type==="income");
    const cashOut=sum(movements,row=>row.movement_type==="expense");
    const generatedCommission=sum(commissions,row=>row.status!=="cancelled");
    const paidCommission=sum(paidCommissions);
    const completedAppointments=appointments.filter(row=>row.status==="completed").length;
    const cancelledAppointments=appointments.filter(row=>row.status==="cancelled").length;
    const noShows=appointments.filter(row=>row.status==="no_show").length;
    const averageTicket=closedOrders.length?sum(closedOrders,()=>true,"total")/closedOrders.length:0;
    const pendingOrders=orders.filter(row=>["open","in_progress","awaiting_payment","partially_paid"].includes(row.status)).length;


 return {received,refunded,cashIn,cashOut,generatedCommission,paidCommission,completedAppointments,cancelledAppointments,noShows,averageTicket,pendingOrders};
}
