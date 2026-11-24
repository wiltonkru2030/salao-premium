/**
 * Normalização e validação do CNPJ numérico e alfanumérico.
 * Aplicado aos dados fiscais de MEI sem depender da máscara ou do navegador.
 */

/** Remove os separadores aceitos e converte letras ASCII para maiúsculas. */
export function normalizeCnpj(value) {
  const raw = String(value ?? "");
  if (!/^[0-9A-Za-z./\s-]*$/.test(raw)) return "";
  return raw.replace(/[./\s-]/g, "").toUpperCase();
}

/** Verifica os 12 caracteres de base e os dois dígitos conforme a Receita Federal. */
export function validCnpj(value) {
  const document = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(document) || /^([0-9])\1{13}$/.test(document)) {
    return false;
  }
  const checkDigit = base => {
    const sum = Array.from(base).reduce((total, char, index) => {
      const weight = 2 + (base.length - index - 1) % 8;
      return total + (char.charCodeAt(0) - 48) * weight;
    }, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const base = document.slice(0, 12);
  const first = checkDigit(base);
  return document.endsWith(String(first) + checkDigit(base + first));
}
