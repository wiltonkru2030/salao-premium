/**
 * Configuração multipágina do Vite.
 * Gera o painel administrativo, o App Profissional e a Área da Cliente em entradas independentes.
 */
import {readFileSync} from "node:fs";

/** Mantém a URL do worker e os ícones do manifesto estáveis no build multipágina. */
function professionalPwaAssets(){
 return {name:"professional-pwa-assets",generateBundle(){
  for(const name of ["sw.js","manifest.webmanifest","icon.svg"]){
   this.emitFile({type:"asset",fileName:"professional/"+name,source:readFileSync(new URL("./professional/"+name,import.meta.url))});
  }
 }};
}
export default {
  plugins:[professionalPwaAssets()],
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
