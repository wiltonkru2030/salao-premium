import { searchPublicSalons } from "./salonDirectoryService.js";

/**
 * Módulo: geoSalonService.js
 * Responsabilidade: obter localização com consentimento e calcular distâncias.
 * A localização é mantida em memória; não é enviada nem persistida automaticamente.
 */
/** Obtém coordenadas somente após ação explícita da cliente e mantém o resultado em memória.
 * @param {object} options Limite de espera e idade máxima do cache do navegador.
 * @returns {Promise<{latitude:number,longitude:number,accuracy:number}>} Posição aproximada.
 * @throws {Error} Quando permissão, dispositivo ou tempo de resposta impedirem a leitura.
 */
export function getCurrentPosition({ timeout = 12000, maximumAge = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!globalThis.navigator?.geolocation) {
      reject(new Error("Este aparelho não disponibiliza localização pelo navegador."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      error => {
        const messages = {
          1: "A permissão de localização foi negada. Você pode escolher sua cidade manualmente.",
          2: "Não foi possível identificar sua localização. Escolha sua cidade manualmente.",
          3: "A localização demorou demais. Tente novamente ou escolha sua cidade."
        };
        reject(new Error(messages[error.code] || "Não foi possível obter sua localização."));
      },
      { enableHighAccuracy: false, timeout, maximumAge }
    );
  });
}

/** Valida latitude/longitude antes de qualquer cálculo ou consulta geográfica.
 * @param {number|string} latitude Latitude em graus.
 * @param {number|string} longitude Longitude em graus.
 * @returns {{latitude:number,longitude:number}} Coordenadas numéricas normalizadas.
 * @throws {Error} Quando as coordenadas estiverem fora dos limites geográficos.
 */
export function validateCoordinates(latitude, longitude) {
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error("A localização informada é inválida.");
  }
  return { latitude: lat, longitude: lng };
}

/** Calcula distância geodésica aproximada entre dois pontos pelo método de Haversine.
 * @param {{latitude:number,longitude:number}} origin Ponto de origem.
 * @param {{latitude:number,longitude:number}} destination Ponto de destino.
 * @returns {number} Distância aproximada em quilômetros.
 * @throws {Error} Quando qualquer ponto não contiver coordenadas válidas.
 */
export function distanceInKm(origin, destination) {
  const a = validateCoordinates(origin?.latitude, origin?.longitude);
  const b = validateCoordinates(destination?.latitude, destination?.longitude);
  const radians = value => value * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Pesquisa unidades publicadas próximas às coordenadas autorizadas pela cliente.
 * @param {object} options Cliente Supabase, coordenadas e raio.
 * @returns {Promise<Array<object>>} Unidades publicadas ordenadas por distância.
 * @throws {TypeError|Error} Para coordenadas inválidas ou falha da RPC pública.
 */
export async function findNearbySalons({client,latitude,longitude,radiusKm=30,limit=30}={}) {
  const coordinates = validateCoordinates(latitude, longitude);
  return searchPublicSalons({
    client,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    radiusKm,
    limit
  });
}
