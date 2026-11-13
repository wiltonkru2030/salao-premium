# Índice de arquivos — SALÃO PREMIUM

Use este índice para localizar a responsabilidade de cada arquivo. Arquivos de imagem e ícones ficam na pasta `brand/` e são recursos visuais, não módulos executáveis.

## Raiz e automação

| Arquivo | O que é / o que faz |
|---|---|
| `index.html` | Documento de entrada do painel, metadados, estilos e diagnóstico de falha durante a inicialização. |
| `app.js` | Ponto de entrada mínimo do painel; importa `src/app.js`. |
| `styles.css` | Agregador dos estilos do painel administrativo. |
| `package.json` | Scripts de desenvolvimento, build e testes; versão mínima de Node. |
| `.github/workflows/app-validation.yml` | Verifica sintaxe JavaScript, build e regressões de utilitários, erros, Comanda, Caixa e Orçamentos. |
| `.github/workflows/agenda-tests.yml` | Executa os testes de regressão da Agenda. |

## Painel — núcleo

| Arquivo | O que é / o que faz |
|---|---|
| `src/app.js` | Inicialização, listeners globais e fluxos de criação/edição/estado da Agenda. É um dos arquivos que mais precisa de divisão. |
| `src/state.js` | Estado compartilhado da interface, usuário, organização, menu, página e Agenda. |
| `src/data/index.js` | Dados demonstrativos, configurações e metadados de navegação/ícones. |
| `src/utils.js` | Funções compartilhadas de escape HTML, toast, cabeçalho, botão, status, métricas e campos. |
| `src/utils/input-masks.js` | Máscaras de CPF, CNPJ, telefone, CEP e moeda; conversão de valor brasileiro para número. |
| `src/utils/errors.js` | Mensagens seguras, logs com código de referência e captura global de erros JavaScript/rejeições. |
| `src/layout/render.js` | Monta menu, cabeçalho, conteúdo da página e encaminha carregadores de módulos. |
| `src/components/drawer.js` | Painel compartilhado de detalhes, propriedades e edição. |
| `src/components/autocomplete.js` | Campo de busca com sugestões e função de limpeza/desmontagem. |
| `src/auth/auth.js` | Login, cadastro, sessão, contexto de organização e saída. |
| `src/auth/auth-screen.js` | HTML da tela de autenticação. |
| `src/auth/auth.css` | Estilos específicos da autenticação. |
| `src/supabase/client.js` | Cria o cliente Supabase e configura persistência/renovação da sessão. |
| `src/supabase/data-service.js` | Serviço genérico de CRUD com allowlist e filtro por organização; nem todas as páginas o utilizam ainda. |
| `src/supabase/README.md` | Documentação da integração Supabase. |

## Páginas administrativas

| Arquivo | O que é / o que faz |
|---|---|
| `src/pages/dashboard.js` | Monta o dashboard inicial. |
| `src/pages/agenda.js` | Adaptador de rota da Agenda para o layout administrativo. |
| `src/pages/customers.js` | Lista e cadastro de clientes. |
| `src/pages/professionals.js` | Equipe profissional, cadastro fiscal, serviços vinculados e permissões do App Profissional. |
| `src/pages/services.js` | Lista e cadastro de serviços. |
| `src/pages/products.js` | Lista e cadastro de produtos/estoque. |
| `src/pages/comanda.js` | Consulta comandas, itens, pagamentos, serviços e produtos lançados. |
| `src/pages/commissions.js` | Consulta e gestão de comissões. |
| `src/pages/recycle-bin.js` | Histórico de exclusões, detalhes, restauração e exclusão permanente. |
| `src/pages/team.js` | Gestão de usuários/equipe e permissões administrativas. |
| `src/pages/records.js` | Componente de listagem com dados demonstrativos; não é CRUD de produção. |
| `src/pages/sales.js` | Adaptador atual para listagem demonstrativa de Vendas. |
| `src/pages/cash.js` | Adaptador atual para listagem demonstrativa de Caixa. |
| `src/pages/finance.js` | Adaptador atual para listagem demonstrativa de Financeiro. |
| `src/pages/reports.js` | Adaptador atual para listagem demonstrativa de Relatórios. |
| `src/pages/branches.js` | Adaptador atual para listagem demonstrativa de Unidades. |
| `src/pages/settings.js` | Navegação de preferências demonstrativas; ainda não persiste configurações no banco. |

## Agenda

| Arquivo | O que é / o que faz |
|---|---|
| `src/agenda/README.md` | Explica o fluxo atual e diferencia o serviço Supabase do repositório local legado. |
| `src/agenda/pages/agenda-page.js` | Consulta dados da Agenda no Supabase, adapta os registros e compõe o calendário. |
| `src/agenda/components/agenda-filters.js` | Filtros de busca e status. |
| `src/agenda/components/agenda-toolbar.js` | Navegação de período e alternância de visualização. |
| `src/agenda/components/appointment-card.js` | Cartão visual de agendamento. |
| `src/agenda/components/appointment-drawer.js` | Detalhes/ações de agendamento. |
| `src/agenda/components/appointment-form.js` | Formulário de criação e edição de agendamento. |
| `src/agenda/components/block-time-modal.js` | Formulário de bloqueio de horário. |
| `src/agenda/components/day-calendar.js` | Calendário diário. |
| `src/agenda/components/week-calendar.js` | Calendário semanal. |
| `src/agenda/components/month-calendar.js` | Calendário mensal. |
| `src/agenda/components/professional-selector.js` | Seletor de profissional. |
| `src/agenda/components/time-slot.js` | Representação de faixa/horário disponível. |
| `src/agenda/hooks/use-agenda.js` | Adaptador de estado e navegação da Agenda (não é React hook). |
| `src/agenda/hooks/use-appointments.js` | Adaptador para consultas no repositório local legado. |
| `src/agenda/hooks/use-availability.js` | Adaptador de validação de disponibilidade. |
| `src/agenda/services/agenda.service.js` | Repositório local demonstrativo em memória; não é o fluxo Supabase atual. |
| `src/agenda/services/availability.service.js` | Valida disponibilidade e conflitos localmente. |
| `src/agenda/utils/conflict.utils.js` | Regras de sobreposição e conflito de horários. |
| `src/agenda/utils/date.utils.js` | Operações de data, dia e semana. |
| `src/agenda/utils/duration.utils.js` | Cálculos de duração de atendimento. |
| `src/agenda/styles/agenda.css` | Estilos específicos do módulo Agenda. |
| `src/agenda/tests/agenda.test.js` | Testes básicos de Agenda. |
| `src/agenda/tests/conflicts.test.js` | Testes de conflito e sobreposição. |
| `src/agenda/tests/render.test.js` | Testes de renderização dos componentes. |
| `src/agenda/tests/services.test.js` | Testes dos serviços/repositório local. |
| `src/agenda/tests/run.js` | Executor dos testes de Agenda. |

## Estilos do painel

| Arquivo | O que é / o que faz |
|---|---|
| `src/styles/base.css` | Reset e estilos base. |
| `src/styles/shell.css` | Menu lateral, cabeçalho e estrutura principal. |
| `src/styles/agenda.css` | Estilos de Agenda no painel. |
| `src/styles/lists.css` | Listas e cartões de registros. |
| `src/styles/settings.css` | Configurações. |
| `src/styles/drawer.css` | Painéis laterais/drawers. |
| `src/styles/effects.css` | Efeitos e transições. |
| `src/styles/responsive.css` | Ajustes responsivos. |
| `src/styles/components.css` | Componentes visuais compartilhados. |
| `src/styles/design-system.css` | Agregador final das camadas CSS globais. |
| `src/styles/design-layout.css` | Tokens, reset e base visual. |
| `src/styles/design-navigation.css` | Navegação e shell. |
| `src/styles/design-components.css` | Botões, campos, formulários, cartões e listas. |
| `src/styles/design-data.css` | Tabelas, comissões e históricos. |
| `src/styles/design-accessibility.css` | Foco, acessibilidade e responsividade. |
| `src/styles/design-overrides.css` | Ajustes transversais. |
| `src/styles/design-modals.css` | Modais e drawers. |
| `src/types/*.d.ts` | Contratos de tenant, Agenda, Comanda, pagamentos, Caixa e Orçamentos. |
| `src/modules/` | Fronteiras e documentação por módulo; migração de páginas legadas em andamento. |
| `src/modules/quotes/components/quote-components.js` | Apresentação isolada do construtor e lista de orçamentos. |
| `src/utils/errors.test.js` | Testes de tradução e sanitização de erros. |

## Módulos e tipos

| Arquivo | O que é / o que faz |
|---|---|
| `src/modules/README.md` | Arquitetura-alvo dos módulos e fronteiras de responsabilidade. |
| `src/modules/quotes/components/quote-components.js` | Componentes puros do construtor e da lista de orçamentos. |
| `src/modules/quotes/services/quote-workflows.js` | Documento imprimível e agendamento agrupado de Orçamentos. |
| `src/modules/quotes/quote-components.test.js` | Testes de apresentação dos Orçamentos. |
| `src/modules/comanda/components/comanda-detail.js` | Componente de apresentação dos detalhes da Comanda, sem acesso ao banco. |
| `src/modules/comanda/comanda.formatters.js` | Rótulos e formatação monetária do domínio Comanda. |
| `src/modules/comanda/services/comanda-operations.js` | Pagamentos e cancelamento por RPC transacional. |
| `src/modules/comanda/comanda-detail.test.js` | Testes do componente Comanda. |
| `src/modules/comanda/comanda.formatters.js` | Formatação de moeda e rótulos do domínio Comanda. |
| `src/modules/cash/components/cash-dashboard.js` | Painel visual do Caixa, sem consulta Supabase. |
| `src/modules/cash/services/cash-operations.js` | Abertura e fechamento por RPC transacional. |
| `src/modules/cash/cash-dashboard.test.js` | Testes do componente Caixa. |
| `src/types/tenant.types.d.ts` | Tipos do tenant, membership e filial. |
| `src/types/operations.types.d.ts` | Tipos de Agenda, Comanda, pagamento, Caixa e Orçamento. |
| `src/utils/errors.test.js` | Regressões de mensagens pt-BR e sanitização. |
| `src/modules/quotes/quote-components.test.js` | Regressões dos componentes de orçamento. |
| `docs/SAAS-MULTITENANT.md` | Contrato de isolamento e auditoria multitenant. |
| `docs/ORCAMENTOS.md` | Fluxo, validações e RPCs atômicas dos Orçamentos. |

## App Profissional

| Arquivo | O que é / o que faz |
|---|---|
| `professional/index.html` | Entrada HTML do PWA profissional. |
| `professional/app.js` | Autenticação, shell, Agenda, Comandas, Comissões e configurações. Ainda é concentrador e precisa ser dividido. |
| `professional/styles.css` | Estilos específicos do PWA profissional, complementando o design system global. |
| `professional/manifest.webmanifest` | Nome, ícones e parâmetros de instalação do PWA. |
| `professional/sw.js` | Service worker e cache offline. |
| `professional/icon.svg` | Ícone do PWA. |

## Auditoria de banco

- `docs/MIGRATIONS.md`: divergência entre migrations remotas e arquivos SQL do repositório.

## Backend Supabase

| Arquivo | O que é / o que faz |
|---|---|
| `supabase/functions/manage-professional-access/index.ts` | Edge Function de criação, redefinição e revogação de acesso profissional. |
| `supabase/functions/professional-cpf-login/index.ts` | Edge Function de autenticação por CPF e senha. |
| `supabase/migrations/*.sql` | Migrações de escopo, permissões, RLS, perfil fiscal e vínculo de serviços. Cada migração registra uma mudança específica do banco. |

## Arquitetura multitenant e contratos

- `src/types/tenant.types.d.ts`: organização ativa, usuário, membership, papel e unidade.
- `src/types/operations.types.d.ts`: entidades operacionais e estados persistidos.
- `src/modules/`: contratos de Agenda, Comanda, Caixa e Orçamentos.
- `docs/SAAS-MULTITENANT.md`: regras de isolamento e auditoria do banco.
- `docs/ORCAMENTOS.md`: operações atômicas e regras comerciais de orçamento.

## Convenção de comentários no código

Cabeçalho de cada módulo: **módulo, responsabilidade, dependências e o que não deve fazer**. Funções exportadas: documentar parâmetros, retorno e efeitos colaterais quando não forem óbvios. Comentários devem explicar regras e motivos, não narrar cada linha.

## Limite desta documentação

O índice descreve a responsabilidade atual dos arquivos, não declara que todos os módulos estejam completos. Os adaptadores de Vendas, Caixa, Financeiro, Relatórios e Unidades ainda exibem dados demonstrativos e precisam de implementação funcional antes de serem considerados prontos.
