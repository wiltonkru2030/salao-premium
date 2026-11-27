/** Concorrência real em QA. Exige psql e DSN seguro; nunca executar em produção. */
import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";
async function main(){
 const dsn=process.env.QA_DATABASE_URL;
 assert.equal(process.env.SUPABASE_TEST_ENV,"isolated","Ambiente de testes obrigatório.");
 assert.ok(dsn,"Informe QA_DATABASE_URL no ambiente.");
 const url=new URL(dsn);
 assert.ok(["postgres:","postgresql:"].includes(url.protocol));
 assert.equal(url.hostname,"db.eaiutjqvyesboldcznyr.supabase.co","Somente conexão direta ao projeto QA autorizado.");
 assert.equal(url.pathname,"/postgres");
 // Não permite parâmetros de conexão que possam alterar o destino.
 assert.equal(url.search,"","Use DSN direto sem parâmetros de consulta; SSL via PGSSLMODE.");
 const ids=Object.fromEntries(["o","b","p","u","a","c","s","k"].map(key=>[key,randomUUID()]));
 const {o,b,p,u,a,c,s,k}=ids,name="QA concorrência "+o;
 const slot="((now() at time zone 'America/Campo_Grande')::date+3+time '10:00')";
 /** Cada comando abre um processo psql independente; não imprime DSN ou credenciais. */
 function sql(query){
  return new Promise((resolve,reject)=>{
   const child=spawn("psql",["-X","-q","-t","-A","-v","ON_ERROR_STOP=1"],{env:{...process.env,PGDATABASE:dsn,PGSSLMODE:"require"},stdio:["pipe","pipe","pipe"]});
   let out="",err="";
   child.stdout.on("data",chunk=>out+=chunk);child.stderr.on("data",chunk=>err+=chunk);
   child.on("error",reject);child.on("close",code=>code===0?resolve(out.trim().split("\n").filter(Boolean).at(-1)):reject(Error("Falha SQL (psql): "+err.trim().slice(0,1000))));
   child.stdin.end(query);
  });
 }
 const login=id=>`select set_config('request.jwt.claim.sub','${id}',true);select set_config('request.jwt.claims',jsonb_build_object('sub','${id}','role','authenticated')::text,true);set local role authenticated;`;
 const setup=`begin;
 insert into auth.users(id,email) values('${u}','qa-${u}@example.invalid'),('${a}','qa-${a}@example.invalid');
 insert into public.profiles(id,full_name) values('${u}','QA concorrência profissional'),('${a}','QA concorrência proprietário') on conflict(id) do nothing;
 insert into public.organizations(id,name,timezone) values('${o}','${name}','America/Campo_Grande');
 insert into public.branches(id,org_id,name,is_main) values('${b}','${o}','QA concorrência',true);
 insert into public.org_memberships(org_id,user_id,role,status) values('${o}','${u}','professional','active'),('${o}','${a}','owner','active');
 insert into public.professionals(id,org_id,branch_id,profile_id,name,active,access_enabled,can_edit_own_orders,commission_rate) values('${p}','${o}','${b}','${u}','QA concorrência',true,true,true,50);
 insert into public.branch_business_hours(org_id,branch_id,weekday,opens_at,closes_at) values('${o}','${b}',extract(dow from ${slot})::int,'08:00','18:00') on conflict do nothing;
 insert into public.professional_working_hours(org_id,professional_id,weekday,starts_at,ends_at) values('${o}','${p}',extract(dow from ${slot})::int,'08:00','18:00') on conflict do nothing;
 insert into public.customers(id,org_id,branch_id,name,phone) values('${c}','${o}','${b}','QA cliente','67999991234');
 insert into public.services(id,org_id,branch_id,name,duration_minutes,price) values('${s}','${o}','${b}','QA serviço',30,50);
 insert into public.professional_services(org_id,professional_id,service_id) values('${o}','${p}','${s}');
 commit;`;
 /** Vencedor mantém a transação aberta para que outra conexão dispute a mesma operação. */
 function worker(actor,expression){
  return sql(`begin;set local statement_timeout='25s';${login(actor)}
 do $race$ declare started timestamptz:=clock_timestamp();result jsonb;code text:='ok';begin
 begin result:=${expression};exception when others then code:=sqlstate;result:=jsonb_build_object('message',sqlerrm);end;
 if code='ok' and coalesce(result->>'replayed','false')='false' then perform pg_sleep(5);end if;
 perform set_config('qa.race_result',jsonb_build_object('pid',pg_backend_pid(),'started',started,'ended',clock_timestamp(),'code',code,'result',result)::text,true);
 end $race$;
 select current_setting('qa.race_result');commit;`).then(JSON.parse);
 }
 /** Aguarda os dois processos, exige sobreposição observada, não aprova disputa sequencial. */
 async function race(actor,expression){
  const settled=await Promise.allSettled([worker(actor,expression),worker(actor,expression)]);
  if(settled.some(x=>x.status==="rejected"))throw Error("Uma conexão do teste falhou: "+settled.filter(x=>x.status==="rejected").map(x=>x.reason.message).join("; "));
  const rows=settled.map(x=>x.value);
  assert.notEqual(rows[0].pid,rows[1].pid,"Conexões devem ser independentes.");
  assert.ok(Math.max(...rows.map(x=>Date.parse(x.started)))<Math.min(...rows.map(x=>Date.parse(x.ended))),"Teste inconclusivo: transações não se sobrepuseram.");
  return rows;
 }
 let executionError=null,cleanupError=null;
 try{
  await sql(setup);
  const agenda=await race(u,`public.create_professional_unit_appointment('${o}','${c}','${s}',${slot})`);
  assert.equal(agenda.filter(x=>x.code==="ok").length,1);
  assert.equal(agenda.filter(x=>x.code==="23P01").length,1);
  assert.equal(Number(await sql(`select count(*) from public.appointments where org_id='${o}';`)),1);
  const appt=agenda.find(x=>x.code==="ok").result.id;
  const ord=await sql(`begin;${login(u)}select public.professional_attendance_action('${o}','${appt}','start')->>'order_id';commit;`);
  await sql(`begin;${login(u)}select public.professional_attendance_action('${o}','${appt}','finish');commit;`);
  await sql(`begin;${login(a)}select public.open_cash_register_for_branch('${o}','${b}',100);commit;`);
  const payment=await race(a,`public.register_service_order_payment_once('${ord}',25,'pix','${k}')`);
  assert.ok(payment.every(x=>x.code==="ok"));
  assert.equal(payment.filter(x=>x.result.replayed).length,1);
  assert.equal(payment[0].result.payment_id,payment[1].result.payment_id);
  const summary=JSON.parse(await sql(`select jsonb_build_object('payments',(select count(*) from public.service_order_payments where org_id='${o}'),'received',(select coalesce(sum(amount),0) from public.service_order_payments where org_id='${o}' and status='confirmed'),'cash',(select count(*) from public.cash_movements where org_id='${o}' and movement_type='income'),'commission',(select coalesce(sum(amount),0) from public.commissions where org_id='${o}'));`));
  assert.deepEqual(summary,{payments:1,received:25,cash:1,commission:12.5});
  console.log("Agenda e recebimento: transações sobrepostas, invariantes aprovadas.");
 }catch(error){executionError=error;}
 finally{
  try{
   // Limpeza exclusiva da organização sintética; estorna antes de remover e respeita FKs.
   await sql(`begin;
   do $guard$ begin
    if exists(select 1 from public.organizations where id='${o}' and name<>'${name}') then raise exception 'Identidade de teste divergente';end if;
   end $guard$;
   ${login(a)}
   do $cancel$ declare item record;begin
    for item in select id from public.service_orders where org_id='${o}' and status in ('open','in_progress','partially_paid','awaiting_payment') loop
     perform public.cancel_service_order(item.id,true);
    end loop;
   end $cancel$;
   reset role;
   delete from public.commissions where org_id='${o}';
   delete from public.service_order_payments where org_id='${o}';
   delete from public.cash_movements where org_id='${o}';
   delete from public.service_order_items where org_id='${o}';
   delete from public.service_orders where org_id='${o}';
   delete from public.appointments where org_id='${o}';
   delete from public.audit_events where org_id='${o}';
   delete from public.audit_logs where org_id='${o}';
   delete from public.recycle_bin where org_id='${o}';
   delete from public.organizations where id='${o}' and name='${name}';
   delete from auth.users where (id='${u}' and email='qa-${u}@example.invalid') or (id='${a}' and email='qa-${a}@example.invalid');
   delete from public.audit_events where org_id='${o}' or actor_id in ('${u}','${a}');
   delete from public.audit_logs where org_id='${o}' or actor_id in ('${u}','${a}');
   delete from public.recycle_bin where org_id='${o}' or deleted_by in ('${u}','${a}');
   commit;`);
   const left=JSON.parse(await sql(`select jsonb_build_object('orgs',(select count(*) from public.organizations where id='${o}'),'users',(select count(*) from auth.users where id in ('${u}','${a}')),'audit',(select count(*) from public.audit_events where org_id='${o}'),'logs',(select count(*) from public.audit_logs where org_id='${o}'),'recycle',(select count(*) from public.recycle_bin where org_id='${o}'));`));
   assert.ok(Object.values(left).every(n=>n===0),"Restaram dados de teste.");
   console.log("Limpeza QA conferida.");
  }catch(error){cleanupError=error;console.error("Falha de limpeza QA; IDs fictícios para inspeção:",ids);}
 }
 if(cleanupError)throw cleanupError;
 if(executionError)throw executionError;
}
await main();
