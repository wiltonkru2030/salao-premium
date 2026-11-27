/** Regressão de layout no Chromium com views e CSS reais, sem serviços externos.
 * Capturas são evidência de renderização, não homologação de fluxos Auth/SQL.
 */
import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {chromium} from "playwright";
const base=process.env.VISUAL_BASE_URL||"http://127.0.0.1:4173";
const folder="artifacts/professional-visual";
const scenarios=["Login","Agenda","Novo agendamento","Cadastro rápido","Atendimento","Clientes","Cadastro de cliente","Serviços","Cadastro de serviço","Comandas","Itens da comanda","Comissões","Notificações","Perfil","Configurações"];
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[],results=[];
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
     if(scenario==="Novo agendamento"||scenario==="Cadastro rápido"){
      assert.equal(await page.locator("dialog").evaluate(d=>d.open),true);
      const visible=await page.locator("dialog form").evaluateAll(forms=>forms.filter(form=>getComputedStyle(form).display!=="none").length);
      assert.equal(visible,1,"Formulários sobrepostos");
      if(scenario==="Novo agendamento"){
       assert.equal(await page.locator("dialog input[type=date]").count(),0);
       const hour=page.locator("dialog input[name=start]"),suggestions=page.locator("[data-booking-suggestions]");
       assert.equal(await hour.isEnabled(),true,"Hora manual bloqueada");
       await page.locator("[data-booking-client]").fill("Cliente");
       await page.getByRole("option",{name:/Cliente Fictícia/}).click();
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
     if(scenario==="Agenda"){
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
     if(scenario==="Configurações"){
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
