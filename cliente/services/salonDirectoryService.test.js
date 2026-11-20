/**
 * Testes do diretório público e catálogo da Área da Cliente.
 * Responsabilidade: validar filtros, parâmetros RPC e erros seguros.
 * Ecossistema: PWA da cliente SALÃO PREMIUM.
 */
import assert from "node:assert/strict";
import { searchPublicSalons, getPublicSalonCatalog } from "./salonDirectoryService.js";

const branchId = "22222222-2222-4222-8222-222222222222";

function mockClient(responses) {
  const calls = [];
  return {
    calls,
    client: {
      rpc(name, args) {
        calls.push({ name, args });
        return Promise.resolve(responses[name]);
      }
    }
  };
}

async function run() {
  const rows = [{ slug: "studio-centro", branch_id: branchId, city: "Três Lagoas" }];
  const search = mockClient({ search_public_salons: { data: rows, error: null } });
  assert.deepEqual(await searchPublicSalons({
    client: search.client, query: "Studio", city: "Três Lagoas", state: "ms",
    latitude: -20.79, longitude: -51.70, radiusKm: 25, limit: 10
  }), rows);
  assert.deepEqual(search.calls[0], {
    name: "search_public_salons",
    args: {
      p_query: "Studio", p_city: "Três Lagoas", p_state: "MS",
      p_latitude: -20.79, p_longitude: -51.70, p_radius_km: 25, p_limit: 10
    }
  });

  const catalogRows = [{ service_id: "service-1", service_name: "Corte" }];
  const catalog = mockClient({ get_public_salon_catalog: { data: catalogRows, error: null } });
  assert.deepEqual(await getPublicSalonCatalog({
    client: catalog.client, slug: "studio-centro", branchId
  }), catalogRows);
  assert.deepEqual(catalog.calls[0], {
    name: "get_public_salon_catalog",
    args: { p_slug: "studio-centro", p_branch_id: branchId }
  });

  await assert.rejects(() => searchPublicSalons({
    client: search.client, latitude: -20, longitude: null
  }), { name: "TypeError" });
  await assert.rejects(() => searchPublicSalons({
    client: search.client, state: "Mato Grosso"
  }), { name: "TypeError" });
  await assert.rejects(() => searchPublicSalons({
    client: search.client, radiusKm: 500
  }), { name: "TypeError" });
  await assert.rejects(() => getPublicSalonCatalog({
    client: catalog.client, slug: "Studio Centro"
  }), { name: "TypeError" });

  const missing = mockClient({
    search_public_salons: { data: null, error: { code: "PGRST202", message: "SQL privado" } }
  });
  await assert.rejects(() => searchPublicSalons({ client: missing.client }),
    error => error.code === "CUSTOMER_DIRECTORY_NOT_READY"
      && !error.message.includes("SQL privado"));

  await assert.rejects(() => getPublicSalonCatalog({ client: {} }), { name: "TypeError" });
  console.log("Testes do diretório público de salões: OK");
}

run().catch(error => {
  process.stderr.write("Falha nos testes do diretório público: " + error.message + "\n");
  process.exitCode = 1;
});
