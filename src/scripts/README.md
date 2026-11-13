# Scripts internos

Scripts de manutenção, verificação e tarefas administrativas ficam fora de `src/app.js` e não são importados no navegador.

- `scripts/` na raiz: automações de build, auditoria, migração e manutenção do repositório.
- `src/modules/<modulo>/scripts/`: tarefas específicas do módulo, sem segredos e sem credenciais.
- Scripts de dados de teste devem exigir ambiente explicitamente não produtivo e nunca executar limpeza ou reset automático no Supabase.
- Toda alteração de banco precisa de migration versionada e revisão de RLS.
