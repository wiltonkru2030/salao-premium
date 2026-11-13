# Módulo Orçamentos — regras e integração

## Responsabilidade
Gerar proposta comercial por cliente com vários serviços, quantidade, profissional responsável, desconto, validade, observações, aprovação/recusa e agendamento posterior.

## Estrutura de código
- `src/pages/quotes.js`: estado da tela, consultas e ações do módulo; adaptador legado em migração.
- `src/modules/quotes/components/quote-components.js`: componentes de apresentação do construtor e da lista. Não acessa Supabase.
- `src/modules/quotes/README.md`: contrato e regras do módulo.
- `src/modules/quotes/quote-components.test.js`: testes de apresentação, escape HTML e permissão.
- `src/styles/quotes.css`: composição específica; usa os tokens globais.

## Dados e isolamento
Tabelas: `quotes`, `quote_items`, `quote_settings`, `quote_discount_services`, `customers`, `services`, `professionals`.

Todas as gravações são limitadas ao `org_id` ativo e sujeitas a RLS. A unidade é validada no servidor. O cliente não define livremente o preço ou duração do serviço: a RPC consulta o catálogo da própria organização.

## Operações atômicas
- `create_quote_with_items`: cria cabeçalho e itens na mesma transação; valida papel, cliente, unidade, serviço, profissional habilitado e regras de desconto. Preço e duração são lidos do serviço no banco. Se qualquer item falhar, nada do orçamento é gravado.
- `save_quote_discount_settings`: salva limite, permissão de desconto fixo e lista de serviços em uma única transação; somente owner/admin/manager.
- `create_quote_appointment_group`: agenda os itens de um orçamento aceito em um grupo; a operação é atômica.
- `respond-to-quote`: Edge Function valida token de resposta; somente o hash do token fica armazenado. GET não altera estado.

## Regras comerciais
- Orçamento pendente não movimenta Caixa, estoque ou comissão.
- Somente orçamento aceito pode ser agendado.
- O agendamento cria um registro por serviço e profissional, vinculados por `appointment_group_id`.
- Descontos são permitidos somente para serviços configurados e respeitam o limite percentual do salão.
- Desconto fixo depende de configuração e também respeita o limite percentual equivalente.
- Profissional indicado precisa estar ativo e habilitado para aquele serviço.

## Limitações
O PDF é gerado pelo diálogo de impressão do navegador; não existe geração PDF server-side nem anexo automático na API do WhatsApp. O envio pelo WhatsApp abre mensagem preparada e o usuário anexa o PDF salvo.

## Migrations
- `20261113003842_quotes_and_grouped_appointments`
- `20261113004028_enforce_quote_discount_rules_and_totals`
- `20261113004223_support_fixed_value_quote_discounts`
- `20261113004247_index_quote_group_foreign_keys_and_lock_discount_settings`
- `20261113004409_atomic_quote_appointment_group_booking`
- `20261113004419_atomic_grouped_quote_scheduling_and_quote_item_lifecycle`
- `20261113004537_split_quote_rls_read_and_write_policies`
- `20261113004807_quote_quantity_aware_appointment_duration`
- `20261113011533_create_quotes_atomically_with_tenant_validation`
- `20261113011612_save_quote_discount_settings_atomically`

## Testes
`npm run test:quotes` valida renderização dos componentes. Build e testes automatizados não substituem o teste integrado com duas organizações e agendamentos reais controlados.
