/**
 * Módulo: favoritesService.js
 * Responsabilidade: gerenciar salões favoritos da identidade global.
 * Depende de tabela própria com RLS por auth.uid(); não reutilizar dados do tenant.
 */
function notReady() {
  const error = new Error("Seus salões favoritos estarão disponíveis após a implantação do perfil global.");
  error.code = "FAVORITES_NOT_READY";
  return error;
}
export async function listFavorites() { throw notReady(); }
export async function addFavorite() { throw notReady(); }
export async function removeFavorite() { throw notReady(); }
