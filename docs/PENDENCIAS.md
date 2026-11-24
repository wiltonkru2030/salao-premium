# Registro de pendências do Salão Premium

Use o identificador para vincular código, teste e evidência de conclusão. O status está indicado quando há evidência de conclusão. As demais linhas seguem abertas.

| ID | Módulo e referência | Prioridade e gravidade | Solução, dependência e aceite |
| --- | --- | --- | --- |
| AUD-01 | `docs/`, workflows e Supabase | Alta, incompletude de evidência | Concluir inventário por arquivo e revisar objetos, logs, controles e configurações disponíveis. Registrar escopo e evidência para cada achado. |
| QA-01 (resolvida) | `src/agenda/tests/services.test.js` | Alta, CI dependente do fuso | Fixture ajustada. A suíte completa passou em UTC e em America/Sao_Paulo, conforme a homologação. |
| DB-01 | `supabase/migrations` e `snapshot-remoto` | Alta, risco de deploy e recuperação | Comparar SQL e efeitos das versões divergentes. Replay de 97 arquivos concluído em QA. Investigar as diferenças de funções, concluir a comparação de objetos e validar o replay local antes de sincronizar a pasta ativa. |
| SEG-01 | Supabase Auth, RLS, funções e papéis | Alta, autorização e credenciais | Confirmar recursos de senha disponíveis, revisar metadados e testar isolamento por papel e unidade em QA. |
| SEG-02 | Matriz e filial, RLS de clientes e agenda, RPC de Caixa | Alta, acesso além da unidade atribuída | A matriz de QA confirmou leitura e atualização de clientes e operações de abertura, resumo e fechamento de Caixa em ambas as unidades por gerente e recepção com vínculo organizacional. Implementar escopo por unidade conforme arquitetura e testar leitura e escrita em unidades atribuídas e não atribuídas, mantendo acesso global dos papéis previstos. |
| UI-01 | `src/styles`, `cliente/styles`, `professional` | Alta, cobertura visual | Consolidar tema, marca e controles compartilhados. Aprovar contraste, responsividade e estados nas três aplicações. |
| UX-01 | `src/components/autocomplete.js` | Alta, seleção inconsistente | Validar descarte de buscas obsoletas, estados, acessibilidade e preenchimento do ID e campos relacionados. |
| FORM-01 | `src/utils/input-masks.js` e formulários | Alta, dados inconsistentes | Auditar máscaras, validação, CEP, formatação pt-BR e casos de colagem e edição. |
| CODE-01 | `scripts/audit-code-structure.mjs` | Média, manutenção | Separar arquivos extensos e documentar responsabilidades e contratos. Validar regressões. |
| OPS-01 | Agenda, Orçamentos, Caixa, Estoque e Comissões | Alta, integridade operacional | Homologar pagamentos, compensações, concorrência e operações integradas no banco de QA. |
| APPS-01 | `cliente` e `professional` | Alta, cobertura de aplicativos | Validar login, revogação, PIN local, papéis, autonomia e fluxos completos. |
| PERF-01 | Build, consultas e advisors | Média, desempenho | Registrar baseline em navegador e banco. Rever índices com carga e planos reais. |
