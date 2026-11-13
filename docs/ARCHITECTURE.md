# Arquitetura e integrações do SALÃO PREMIUM

## Modelo de aplicação
O SALÃO PREMIUM é um SaaS multitenant. Uma conta pode ter associação a uma ou mais organizações; cada organização tem seus próprios clientes, profissionais, serviços, produtos, agendamentos, comandas, caixa, comissões e orçamentos.

## Camadas
- **Interface:** páginas e componentes JavaScript, design system CSS e App Profissional.
- **Orquestração:** `src/app.js` é apenas bootstrap e ciclo do tenant; `src/layout/` roteia; `src/agenda/controllers/` concentra eventos e casos de uso da Agenda.
- **Domínio:** serviços/repositórios por módulo.
- **Persistência:** Supabase Auth, Postgres, RLS, triggers e RPCs transacionais.
- **Contratos:** tipos JSDoc e declarações TypeScript em `src/types/`.

## Organização de código
`src/modules/` define as fronteiras de domínio; `src/pages/` mantém adaptadores/implementações legadas enquanto a migração é feita por etapas. Cada módulo deve separar:
- `pages/`: composição da tela;
- `components/`: apresentação sem SQL;
- `services/`: coordenação de regras de aplicação;
- `repositories/`: consultas Supabase;
- `types/`: contratos;
- `scripts/`: manutenção não carregada pelo navegador;
- `styles/`: CSS específico;
- `tests/`: testes isolados.

Não mover um módulo inteiro em uma única alteração se isso puder quebrar rotas ou integrações. Migrar um fluxo por vez, mantendo adaptadores.

## Isolamento multitenant
- Toda tabela de domínio pertence a uma organização por `org_id`; `branch_id` delimita a unidade quando aplicável.
- Consultas do front-end devem filtrar por organização ativa e filial selecionada.
- RLS é a autoridade de isolamento e valida associação/papel no banco; filtros JS não são segurança.
- RPCs devem derivar e validar a organização a partir do registro e da sessão, não confiar em um `org_id` arbitrário enviado pelo cliente.
- Nunca usar `user_metadata` editável pelo usuário para autorizar acesso.
- Nunca expor chave `service_role` no navegador.
- Testes multitenant devem provar que um membro da organização A não lê, altera ou relaciona registros da organização B.

## Fluxo operacional
1. Profissional habilitado para o serviço é selecionado na Agenda.
2. A Agenda grava cliente, serviço, profissional, unidade e horário.
3. A chegada pode abrir uma Comanda.
4. Serviços de um grupo são vinculados à mesma Comanda por RPC atômica.
5. Cada item da Comanda preserva profissional, preço, quantidade e desconto.
6. Cada pagamento parcial/final cria pagamento e entrada no Caixa.
7. Cada pagamento gera comissão proporcional conforme regra vigente e vínculo com o item.
8. Pagamento de comissão cria saída no Caixa.
9. Estorno permitido cria saída financeira e atualiza o pagamento original.

## Operações críticas
| Módulo | Interface atual | Backend |
|---|---|---|
| Agenda | `src/agenda/pages/agenda-page.js`, `src/app.js` | `appointments`, `appointment_blocks`, triggers e RPC de grupo |
| Comanda | `src/pages/comanda.js` | `service_orders`, itens, pagamentos, RPCs de pagamento/cancelamento |
| Caixa | `src/pages/cash.js` | `cash_registers`, `cash_movements`, RPCs de abertura/fechamento |
| Orçamentos | `src/pages/quotes.js` + componentes em `src/modules/quotes/components/` | `quotes`, `quote_items`, regras e RPC de agendamento |
| Comissões | `src/pages/commissions.js` | regras, ledger e RPC de pagamento |

## Segurança e limites conhecidos
- O histórico remoto contém 58 migrations e o repositório contém 31 arquivos SQL; 33 versões históricas ainda precisam ser reconciliadas. Não resetar nem reaplicar migrations antigas. Consulte `docs/MIGRATIONS.md`.
- RLS está habilitada nas tabelas centrais auditadas de Agenda, Comanda, Caixa, Comissões e Orçamentos.
- O advisor ainda aponta funções `SECURITY DEFINER` expostas a usuários autenticados. Cada uma deve ser revisada individualmente; não revogar em lote porque operações críticas dependem delas e devem validar usuário, tenant e papel internamente.
- A proteção de senha comprometida do Supabase Auth permanece desativada e precisa ser habilitada no painel do projeto.
- O Caixa administrativo atual opera o caixa padrão da organização; seleção completa por filial ainda precisa de fluxo próprio.
- Estorno cobre comandas abertas/parcialmente pagas. Devolução de venda já quitada requer fluxo separado para financeiro e estoque.
- Build/testes automatizados não substituem teste real de isolamento entre dois tenants nem inspeção visual desktop/mobile.
