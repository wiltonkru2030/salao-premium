/** Regressão de layout no Chromium com views e CSS reais, sem serviços externos.
 * Capturas são evidência de renderização, não homologação de fluxos Auth/SQL.
 */
import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
const base=process.env.VISUAL_BASE_URL||"http://127.0.0.1:4173";
const folder="artifacts/professional-visual";
const scenarios=["Login","Agenda","Novo agendamento","Cadastro rápido","Atendimento","Clientes","Ficha do cliente","Cadastro de cliente","Serviços","Cadastro de serviço","Comandas","Itens da comanda","Comissões","Notificações","Perfil","Configurações"];
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[],results=[];
/** Mede distâncias reais entre controles visíveis, incluindo linhas quebradas no celular. */
async function checkControlSpacing(page){
 const violations=await page.evaluate(()=>{
  const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&!el.closest("[hidden]")&&getComputedStyle(el).visibility!=="hidden";};
  const control=el=>el.matches("button,a.btn,input:not([type=hidden]),select,.sp-labeled-field,.professional-card-actions,form,details");
  const groups=document.querySelectorAll(".professional-card-actions,.professional-control-stack,.professional-list-tools,.sp-modal-foot,form:not(.auth-form),.auth-form");
  const bad=[];
  for(const group of groups){
   if(!visible(group)||group.closest("dialog:not([open])"))continue;
   const items=[...group.children].filter(el=>control(el)&&visible(el));
   for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
    const a=items[i].getBoundingClientRect(),b=items[j].getBoundingClientRect();
    const dx=Math.max(a.left-b.right,b.left-a.right),dy=Math.max(a.top-b.bottom,b.top-a.bottom);
    if(dx<7.5&&dy<7.5)bad.push((group.className||group.id||group.tagName)+": "+items[i].textContent.trim().slice(0,35)+" / "+items[j].textContent.trim().slice(0,35)+" ("+dx.toFixed(1)+","+dy.toFixed(1)+")");
   }
  }
  return bad;
 });
 assert.deepEqual(violations,[],"Controles sem espaçamento mínimo");
}
try{
 for(const viewport of [{width:320,height:740},{width:390,height:844},{width:1440,height:900}]){
  const context=await browser.newContext({viewport,locale:"pt-BR",timezoneId:"America/Campo_Grande",reducedMotion:"reduce"});
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/*",route=>{
   const url=new URL(route.request().url());
   if(url.origin!==base)return route.abort();
   if(url.pathname==="/professional/visual-fixture.html")return route.fulfill({contentType:"text/html",body:'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/professional/styles.css"></head><body><div id="professional-app"></div><script type="module" src="/tests/visual/professional-fixture.js"></script></body></html>'});
   return route.continue();
  });
  await page.goto(base+"/professional/visual-fixture.html");
  await page.waitForFunction(()=>!!window.professionalVisualFixture);
  for(const theme of ["light","dark"]){
   for(const scenario of scenarios){
    const label=viewport.width+"-"+theme+"-"+scenario.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().replaceAll(" ","-");
    try{
     await page.evaluate(([scenario,theme])=>window.professionalVisualFixture.show(scenario,theme),[scenario,theme]);
     await page.screenshot({path:folder+"/"+label+".png",fullPage:true,animations:"disabled"});
     const layout=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.querySelector("#professional-app").innerText.trim().length,theme:document.documentElement.dataset.theme,background:getComputedStyle(document.body).backgroundColor}));
     assert.ok(layout.body>20,"Tela vazia");assert.equal(layout.theme,theme);assert.ok(layout.scroll<=layout.width+1,"Rolagem horizontal: "+layout.scroll+" > "+layout.width);
     assert.equal(errors.length,0,errors.join("; "));
     await checkControlSpacing(page);
     if(scenario==="Novo agendamento"||scenario==="Cadastro rápido"){
      assert.equal(await page.locator("dialog").evaluate(d=>d.open),true);
      const visible=await page.locator("dialog form").evaluateAll(forms=>forms.filter(form=>getComputedStyle(form).display!=="none").length);
      assert.equal(visible,1,"Formulários sobrepostos");
      if(scenario==="Novo agendamento"){
       assert.equal(await page.locator("dialog input[type=date]").count(),0);
       const hour=page.locator("dialog input[name=start]"),suggestions=page.locator("[data-booking-suggestions]");
       assert.equal(await hour.isEnabled(),true,"Hora manual bloqueada");
       await page.locator("[data-booking-client]").fill("Cliente");
       await page.getByRole("option",{name:/Cliente Fictícia/}).waitFor();
       assert.equal(await page.getByRole("option",{name:"Cadastrar novo cliente"}).count(),0);
       assert.equal(await page.locator("[data-booking-client] + .autocomplete-menu .autocomplete-result-detail").textContent(),"(67) 99999-1234");
       await page.screenshot({path:folder+"/"+label+"-busca-encontrada.png",fullPage:true,animations:"disabled"});
       await page.getByRole("option",{name:/Cliente Fictícia/}).click();
       await page.locator("[data-booking-client]").fill("Pessoa Nova QA");
       await page.getByRole("option",{name:"Cadastrar novo cliente"}).waitFor();
       await page.screenshot({path:folder+"/"+label+"-busca-vazia.png",fullPage:true,animations:"disabled"});
       await page.getByRole("option",{name:"Cadastrar novo cliente"}).click();
       const quick=page.locator("#professional-booking-quick-customer");
       assert.equal(await quick.isVisible(),true);
       assert.equal(await quick.locator("[name=name]").inputValue(),"Pessoa Nova QA");
       await quick.locator("[name=phone]").fill("67988881234");
       await quick.getByRole("button",{name:"Salvar e selecionar"}).click();
       assert.equal(await page.locator("[data-booking-client]").getAttribute("data-selected-id"),"new-c");
       assert.equal(await page.locator("[data-booking-client]").inputValue(),"Pessoa Nova QA");
       await page.locator("[data-booking-service]").fill("Hidratação");
       await page.getByRole("option",{name:/Hidratação capilar/}).click();
       await suggestions.locator('option[value="13:05"]').waitFor({state:"attached"});
       assert.equal(await suggestions.isEnabled(),true);
       await suggestions.selectOption("13:05");
       assert.equal(await hour.inputValue(),"13:05");
       await hour.fill("14:17");
       assert.equal(await hour.inputValue(),"14:17");
       assert.equal(await page.locator("#professional-new-appointment button[type=submit]").isEnabled(),true);
       assert.equal(await suggestions.inputValue(),"");
      }
     }
     if(scenario==="Ficha do cliente"){
      const actions=page.locator(".professional-customer-actions"),call=actions.getByRole("link",{name:"Ligar"}),edit=actions.getByRole("button",{name:"Editar cadastro"});
      const a=await call.boundingBox(),b=await edit.boundingBox();assert.ok(b.x>=a.x+a.width+8,"Botões sem espaçamento");
     }
     if(scenario==="Agenda"){
      const toggle=page.locator("[data-action=toggle-professional-theme]");
      assert.match(await page.locator(".professional-header-name").textContent(),/Profissional QA/);
      assert.match(await page.locator("[data-professional-greeting]").textContent(),/^(Bom dia|Boa tarde|Boa noite)$/);
      assert.equal(await page.locator(".top .professional-profile-menu").count(),0);
      assert.equal(await page.locator(".professional-sidebar [data-page=Perfil]").count(),1);
      await toggle.click();assert.equal(await page.locator("html").getAttribute("data-theme"),theme==="light"?"dark":"light");
      assert.equal(await toggle.getAttribute("aria-label"),theme==="light"?"Ativar modo claro":"Ativar modo escuro");
      await toggle.click();assert.equal(await page.locator("html").getAttribute("data-theme"),theme);
     }
     if(scenario==="Atendimento"){
      const modal=page.locator("#professional-appointment-dialog");assert.equal(await modal.evaluate(d=>d.open),true);
      assert.equal(await modal.getByRole("heading",{name:"Detalhes do agendamento"}).count(),1);
      await modal.getByRole("button",{name:"Fechar detalhes"}).click();assert.equal(await page.locator("#professional-appointment-dialog[open]").count(),0);
     }
     if(scenario==="Agenda"){
      const card=page.locator("article.appointment").first();assert.equal(await card.getByRole("button",{name:"Iniciar atendimento"}).getAttribute("data-appointment-id"),"a");
      assert.equal(await card.locator("button button").count(),0);
      await card.locator(".professional-appointment-details-button").click();assert.equal(await page.locator("#professional-appointment-dialog[open]").count(),1);
      await page.keyboard.press("Escape");assert.equal(await page.locator("#professional-appointment-dialog[open]").count(),0);
      await page.getByRole("button",{name:"Reagendar",exact:true}).click();assert.equal(await page.locator("#professional-appointment-dialog[open] #professional-reschedule").count(),1);
      await page.locator("#professional-appointment-dialog").getByRole("button",{name:"Fechar detalhes"}).click();
      const layout=await page.locator(".professional-agenda-layout").evaluate(el=>({calendar:el.children[0].getBoundingClientRect().toJSON(),day:el.children[1].getBoundingClientRect().toJSON()}));
      if(viewport.width>=1180){assert.ok(layout.day.left>layout.calendar.right,"Agenda desktop deve separar calendário e atendimentos");}
      else assert.ok(layout.day.top>=layout.calendar.bottom,"Agenda móvel deve manter fluxo vertical");
     }
     if(scenario==="Agenda"&&viewport.width<761){
      await page.getByRole("button",{name:"Abrir menu"}).click();
      assert.equal(await page.locator(".professional-workspace").evaluate(el=>el.inert),true);
      // O botão da barra lateral e a sobreposição têm o mesmo rótulo; testar o controle visível dentro do menu.
      await page.locator("#professional-sidebar").getByRole("button",{name:"Fechar menu",exact:true}).click();
      assert.equal(await page.locator(".professional-workspace").evaluate(el=>el.inert),false);
     }
     if(scenario==="Notificações"){
      const filters=page.locator(".professional-filter-actions"),mark=page.getByRole("button",{name:"Marcar todas como lidas"});
      const a=await filters.boundingBox(),b=await mark.boundingBox();assert.ok(b.y>=a.y+a.height+10,"Marcar todas colado ao filtro");
     }
     if(scenario==="Configurações"){
      const pass=page.locator("#settings-password"),confirm=page.locator("#settings-password-confirm"),save=page.getByRole("button",{name:"Atualizar senha"});
      const a=await pass.boundingBox(),b=await confirm.boundingBox(),s=await save.boundingBox();assert.ok(b.y>a.y+a.height+10);assert.ok(s.y>=b.y+b.height+10);
      await checkControlSpacing(page);
      await page.locator("[name=pixType]").selectOption("phone");
      await page.locator("[name=pixKey]").fill("67999991234");
      assert.equal(await page.locator("[name=pixKey]").inputValue(),"(67) 99999-1234");
     }
     results.push({label,layout,result:"ok"});
    }catch(error){failures.push({label,error:String(error)});results.push({label,result:"failed"});}
   }
  }
  await context.close();
 }
}finally{await browser.close();await writeFile(folder+"/results.json",JSON.stringify({results,failures},null,2));}
assert.equal(failures.length,0,JSON.stringify(failures,null,2));
console.log(results.length+" cenários visuais aprovados no Chromium.");
