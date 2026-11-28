/**
 * Configuração multipágina do Vite.
 * Gera o painel administrativo, o App Profissional e a Área da Cliente em entradas independentes.
 */
import {readFileSync} from "node:fs";

/** Mantém a URL do worker e os ícones do manifesto estáveis no build multipágina. */
function professionalPwaAssets(){
 return {name:"professional-pwa-assets",generateBundle(){
  for(const name of ["sw.js","manifest.webmanifest","icon.svg","notification-icon.webp","notification-badge.png"]){
   this.emitFile({type:"asset",fileName:"professional/"+name,source:readFileSync(new URL("./professional/"+name,import.meta.url))});
  }
 }};
}
/** Resolve o par público do Supabase no build, sem embutir fallback de produção no QA.
 * O Vite fornece env já resolvido (inclui .env e variáveis de CI).
 * Se um ambiente for explicitado, ambos os valores são obrigatórios.
 */
function isolatedSupabaseConfig(){
 let selected=null;
 return {
  name:"isolated-supabase-config",
  enforce:"pre",
  configResolved(config){
   const url=config.env.VITE_SUPABASE_URL?.trim(),key=config.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
   const qa=config.env.VITE_QA_BUILD==="true";
   if(!qa&&url===undefined&&key===undefined)return;
   if(!url||!key)throw new Error("Configure URL e chave publicável do Supabase juntas.");
   if(!key.startsWith("sb_publishable_"))throw new Error("O build aceita apenas chave publicável do Supabase.");
   const parsed=new URL(url);
   if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=="/")throw new Error("URL Supabase inválida.");
   if(qa&&parsed.origin!=="https://eaiutjqvyesboldcznyr.supabase.co")throw new Error("Build QA exige o Supabase de homologação.");
   selected={url:parsed.origin,key};
  },
  transform(_source,id){
   if(!selected||!id.split("?")[0].replaceAll("\\","/").endsWith("/src/supabase/config.js"))return null;
   // Exports estáticos: a URL de produção sequer entra no bundle de QA.
   return {code:"export const SUPABASE_URL="+JSON.stringify(selected.url)+";\nexport const SUPABASE_PUBLISHABLE_KEY="+JSON.stringify(selected.key)+";",map:null};
  }
 };
}

export default {
  plugins:[isolatedSupabaseConfig(),professionalPwaAssets()],
  build: {
    rollupOptions: {
      input: {
        admin: "index.html",
        professional: "professional/index.html",
        cliente: "cliente/index.html"
      }
    }
  }
};
