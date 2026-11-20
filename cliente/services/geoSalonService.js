/**
 * Módulo: geoSalonService.js
 * Responsabilidade: obter localização com consentimento e calcular distâncias.
 * A localização é mantida em memória; não é enviada nem persistida automaticamente.
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

export function validateCoordinates(latitude, longitude) {
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error("A localização informada é inválida.");
  }
  return { latitude: lat, longitude: lng };
}

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

/** Busca de diretório depende da RPC pública e das políticas de catálogo ainda não implantadas. */
export async function findNearbySalons() {
  const error = new Error("A busca de salões será ativada após a implantação segura do diretório público.");
  error.code = "SALON_DIRECTORY_NOT_READY";
  throw error;
}
