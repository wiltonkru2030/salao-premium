/**
 * Configuração multipágina do Vite.
 * Gera o painel administrativo, o App Profissional e a Área da Cliente em entradas independentes.
 */
export default {
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
