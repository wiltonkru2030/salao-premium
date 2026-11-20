/** Consulta paginada com ordem determinística. Não devolve totais parciais em caso de erro.
 * O construtor deve retornar uma consulta nova a cada página, com ordenação estável incluindo o ID.
 * A consistência entre páginas sob gravações concorrentes exige agregação transacional no banco.
 */
export async function readFinancePages(buildQuery,pageSize=250){
 if(typeof buildQuery!=="function"||!Number.isInteger(pageSize)||pageSize<1||pageSize>500)throw new TypeError("Consulta financeira inválida.");
 const rows=[],seen=new Set();
 for(let offset=0;;offset+=pageSize){
  const {data,error}=await buildQuery().range(offset,offset+pageSize-1);
  if(error)throw error;
  if(!Array.isArray(data))throw new Error("Resposta financeira inválida.");
  for(const row of data){
   if(!row.id||seen.has(row.id))throw new Error("Os registros mudaram durante a consulta. Atualize os dados.");
   seen.add(row.id);rows.push(row);
  }
  if(data.length<pageSize)return rows;
 }
}
/** Soma valores monetários em centavos, rejeitando dados inválidos. */
export function sumFinanceAmounts(rows,predicate=()=>true,field="amount"){
 let cents=0;
 for(const row of rows){
  if(!predicate(row))continue;
  const n=Number(row[field]);
  if(row[field]==null||!Number.isFinite(n)||!Number.isSafeInteger(Math.round(n*100))||Number(n.toFixed(2))!==n)throw new Error("Valor financeiro inválido. Solicite conciliação.");
  cents+=Math.round(n*100);
  if(!Number.isSafeInteger(cents))throw new Error("O total financeiro excede o limite de cálculo.");
 }
 return cents/100;
}
