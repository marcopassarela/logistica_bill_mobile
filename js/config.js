/**
 * Logísticas Bill — Configuração
 * ================================
 * Em produção (Vercel): a DATABASE_URL e secrets ficam nas
 * Environment Variables do projeto — NÃO coloque a key aqui.
 *
 * O frontend chama apenas /api/* no mesmo domínio.
 *
 * Local sem Vercel: use enabled: false (LocalStorage).
 */
const LB_CONFIG = {
  /** true = usa API Vercel → Layerbase | false = só LocalStorage */
  enabled: true,
  /** Base das APIs (vazio = mesmo domínio, ideal na Vercel) */
  apiBase: ''
};
