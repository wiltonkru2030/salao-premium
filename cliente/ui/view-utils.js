/**
 * Utilitários compartilhados de renderização.
 * Escapa dados dinâmicos antes de inseri-los no HTML para evitar injeção de marcação.
 */
export function escapeClientHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
