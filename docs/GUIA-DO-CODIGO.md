# Guia técnico e mapa do código

## Entradas
- `index.html` e `app.js`: entrada do painel administrativo.
- `src/app.js`: inicializa sessão, tenant, navegação e eventos de aplicação.
- `professional/app.js`: entrada do App Profissional/PWA.

## Diretórios e padrões
| Caminho | Responsabilidade |
|---|---|
| `src/auth/` | autenticação, seleção e troca explícita de tenant, sessão e membership |
| `src/layout/` | shell, menu e roteamento |
| `src/components/` | componentes compartilhados do painel |
| `src/pages/` | adaptadores e páginas legadas em migração |
| `src/modules/` | fronteiras dos módulos de domínio e seus componentes |
| `src/agenda/` | implementação especializada da Agenda |
| `src/types/` | contratos `.d.ts` de tenant e entidades |
| `src/auth/tenant-context.js` | seleção pura de membership/organização, sem consultar dados do tenant |
| `src/auth/tenant-context.test.js` | testes da seleção explícita de organização |
| `src/scripts/` | regras para scripts internos; não carregar no navegador |
| `src/supabase/` | cliente Supabase |
| `src/utils/` | máscaras, validações, erros e contexto compartilhado |
| `src/styles/` | CSS base e camadas do design system |
| `supabase/migrations/` | alterações SQL incrementais |
| `supabase/functions/` | Edge Functions |

## CSS global
`styles.css` importa estrutura e módulos. `src/styles/design-system.css` é o agregador final de camadas. Consulte `docs/DESIGN_SYSTEM.md`.

## Contratos de tipos
- `src/types/tenant.types.d.ts`: contexto multitenant, papéis e registros pertencentes à organização.
- `src/types/operations.types.d.ts`: Agenda, Comanda, pagamentos, Caixa e Orçamentos.

## Módulos
- Agenda: `src/agenda/` e `src/modules/agenda/README.md`.
- Comanda: `src/pages/comanda.js` e `src/modules/comanda/README.md`.
- Caixa: `src/pages/cash.js` e `src/modules/cash/README.md`.
- Orçamentos: `src/pages/quotes.js`, `src/modules/quotes/components/` e `src/modules/quotes/README.md`.
- Comissões: `src/pages/commissions.js`.

## Padrão de arquivo
Todo arquivo deve declarar responsabilidade, entradas/saídas, dependências, efeitos colaterais e permissões. Funções de domínio devem documentar tabelas/RPCs, tenant e filial, validações e atomicidade. Componentes não consultam banco. Repositórios não montam HTML. Scripts de manutenção não são importados pela aplicação.

## Critério para arquivos pequenos
Dividir arquivos acima de aproximadamente 300 linhas quando houver fronteiras reais (página, componente, serviço, repositório, tipos ou testes). Não fragmentar funções triviais em dezenas de arquivos. Cada módulo deve ter README com tabelas, RPCs, papéis e riscos.

## Segurança
Não confiar em IDs ou papel enviados pelo navegador. RLS/RPC devem validar tenant e membership no banco. Não resetar banco remoto, apagar histórico financeiro ou reaplicar migrations registradas.
