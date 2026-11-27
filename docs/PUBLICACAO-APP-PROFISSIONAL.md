# Preparação da publicação — App Profissional

Data local: 26/11/2026. Base: `595349f4cce14d6b2439322d9d68b82d985e55e7`.

## Evidências atuais

- Agenda e App validation passaram: [Agenda](https://github.com/wiltonkru2030/salao-premium/actions/runs/45929130929), [validação geral](https://github.com/wiltonkru2030/salao-premium/actions/runs/45929130750).
- [Teste visual](https://github.com/wiltonkru2030/salao-premium/actions/runs/45929130864) falhou antes de iniciar o navegador: Ubuntu 26.04 não suportado pelo Playwright 1.55. Workflow fixado em Ubuntu 24.04; nova execução precisa ser confirmada. Nenhuma aprovação visual foi obtida.
- Inventário de metadados em [JSON](migrations/professional-release-audit-2026-11-26.json). Foram comparadas definições por assinatura e hash; não foram lidos dados de clientes, credenciais ou configurações secretas.
- 65 funções no recorte QA e 32 em produção; 33 assinaturas ausentes e 9 definições diferentes. Ausência neste recorte não autoriza copiar funções isoladamente.

## Migrations recentes somente em QA

| Versão QA | Nome |
|---|---|
| 20261127014207 | professional_unit_customer_registration |
| 20261127014343 | professional_unit_direct_booking |
| 20261127014921 | professional_unit_service_management |
| 20261127015204 | professional_individual_attendance |
| 20261127020319 | professional_order_item_management_guard |
| 20261127020921 | professional_app_private_preferences |
| 20261127021133 | professional_notifications_inbox |
| 20261127021953 | cumulative_partial_commission_rounding |
| 20261127022502 | professional_password_server_gate |

Também há diferenças anteriores: escopo de unidades de 24/11, workspace e agendamento em grupo. Três migrations profissionais de 26/11 foram agregadas em produção sob outra versão. A correspondência semântica deve ser conferida. Workspace tem hash diferente entre os ambientes; não presumir equivalência. Alguns arquivos locais usam versão diferente do histórico QA. A auditoria não compara o schema completo.

## Critérios para liberar

1. Capturas e resultados dos 90 cenários visuais; revisão manual em celular e computador.
2. Reconciliar inventários locais, QA e produção por objeto, conteúdo, dependências e ordem; não executar db push nem migration repair automaticamente.
3. Preparar backup verificável e recuperação, e ensaiar migrations em ambiente descartável que reproduza o estado de produção. Revisar segurança, gatilhos e compatibilidade com o painel e cliente.
4. Homologar a Edge Function de senha provisória, login por CPF, corrida entre reset e confirmação e migração de contas antigas. Não implantar isoladamente o gate de senha.
5. Homologar escrita nas filiais, concorrência de agenda, conciliação histórica, fechamento de Caixa e estorno após repasse. Push FCM continua pendente.
6. Habilitar cada flag somente após sua dependência estar implantada e validada. A publicação Firebase atual não injeta essas flags; não ativar implicitamente.
7. Testar fluxo real com conta de teste autorizada e preparar rollback da versão web e das alterações de schema. Autorizar publicação após evidências, não apenas build.

**Decisão desta revisão: nenhuma migration, função, credencial, flag ou deploy de produção foi alterado.**

## Reconciliação — primeira onda

Comparação das sete tabelas `customers`, `services`, `professional_services`, `professionals`, `branches`, `organizations`, `appointments`: 98 colunas em cada ambiente, sem diferenças nos tipos, nulabilidade e defaults do recorte; 42 constraints em cada ambiente, diferença na definição de `professionals_mei_cnpj_check`; 18 gatilhos QA e 17 em produção no recorte consultado, único adicional QA é notificação de agendamento. Os gatilhos comuns têm definições e hashes de funções coincidentes. Isso não prova equivalência de RLS, privilégios, índices ou funções chamadas indiretamente.

Pré-verificação somente leitura [SQL](sql/professional-wave1-preflight.sql) e [evidência JSON](migrations/professional-wave1-preflight-2026-11-26.json) executadas nos dois ambientes: QA: 39/39 condições presentes; produção: 39/39 condições presentes. Não aplica nenhuma migration. A ordem recomendada para ensaio é cadastro de clientes, catálogo de serviços, agendamento direto. A validação estrutural não autoriza produção: antes é necessário conferir políticas/grants e funções auxiliares, resolver o histórico divergente e executar um ensaio numa cópia fiel de produção com testes de isolamento e concorrência. Não copiar o histórico QA sobre produção. Nenhum dado real ou schema de produção foi modificado.

## Segurança da primeira onda — 26/11/2026

Comparação em modo somente leitura: 29 políticas RLS em QA e 26 em produção nas sete tabelas da primeira onda. As 26 comuns coincidem; faltam as políticas restritivas de escopo de funcionários em appointments, branches e customers. As 98 concessões de tabela (anon/authenticated/PUBLIC) coincidem. Quatro helpers de autorização têm definições divergentes; has_staff_branch_scope não existe em produção. Os seis RPCs públicos novos de cliente, serviço e agendamento são SECURITY INVOKER em QA, sem EXECUTE para anon; implementações privadas são SECURITY DEFINER, com validação de vínculo e unidade. Helper professional_customer_branch sem EXECUTE direto para anon/authenticated. Não copiar as políticas sem suas dependências ou confundir permissões de equipe com permissões de profissionais.

Teste integrado [professional-isolation-qa.sql](sql/professional-isolation-qa.sql) executado em QA com três profissionais fictícios, duas unidades e outra organização: agenda/comanda alheias ocultas; edição de serviço de outro autor e atendimento alheio negados; notificação alheia inacessível e marcação retorna zero; carteira da mesma unidade compartilhada intencionalmente; clientes e serviços da outra filial ocultos, edição/vínculo/agendamento cruzados negados; agendamento na filial própria aprovado; acesso a outro salão negado. Todos os registros revertidos. Advisors QA: quatro INFO de tabelas privadas sem política direta, intencionalmente fechadas. Não equivale a auditoria integral.

O Chromium instalou e executou os cenários no runner corrigido, mas a validação falhou em quatro interações de fechar menu móvel: seletor genérico escolhia a sobreposição por trás do menu. Ajustado o seletor para o botão interno da barra lateral; nova execução pendente. A revisão estética das capturas e teste autenticado continuam pendentes. Produção não alterada.

## Reconciliação do pacote de escopo de funcionários

A consulta ampliada identificou 17 políticas restritivas de unidade em QA e zero em produção: Agenda (appointments, appointment_blocks, appointment_groups, appointment_waitlist), branches, customers, Caixa (cash_movements, cash_registers), expenses, estoque (inventory_movements), vendas (sales, sale_items), comandas (service_orders, service_order_items, service_order_payments), pacotes (service_packages, service_package_items). A tabela branch_memberships e a função private.has_staff_branch_scope também não existem em produção. O recorte anterior de três políticas não representava o pacote completo.

Pré-verificação somente leitura: na consulta de 26/11, produção tinha três vínculos ativos owner e nenhum gerente/recepcionista ativo; QA não tinha vínculos ativos desses papéis antes dos testes. Contagens são uma fotografia, não autorização para implantação. Repetir a consulta imediatamente antes de qualquer atualização. Se houver funcionários ativos sem unidade atribuída, interromper e cadastrar a unidade real com autorização do proprietário; não atribuir matriz automaticamente.

### Ordem de ensaio (não executar diretamente em produção)

1. `20261124121304_scope_staff_to_assigned_branches.sql`: tabela de atribuições, chaves, RLS, helper. Conferir grants e compatibilidade dos objetos existentes.
2. Popular atribuições autorizadas (quando necessárias) e testar proprietários e gerentes/recepção. Reexecutar a pré-verificação.
3. `20261124121700_enforce_unit_scope_for_staff.sql`: políticas de unidades, clientes, agenda, Caixa e despesas; RPCs relacionadas.
4. `20261124121910_constrain_linked_financial_staff_operations.sql`: comandas, pagamentos, vendas, estoque e RPCs financeiras.
5. `20261124122045_scope_agenda_workflows_to_assigned_units.sql`: espera, grupos e início de atendimento.
6. `20261124122253_scope_service_package_management.sql`: pacotes.
7. `20261124214835_scope_expense_cancellation_to_assigned_units.sql`: cancelamento de despesas. Revisar a migration de CNPJ alfanumérico separadamente, por não integrar o escopo de funcionários.

Esses nomes são os arquivos locais, não os números do histórico remoto QA. Reconciliar por conteúdo, sem renomear histórico nem reaplicar por versão automaticamente. A ordem acima é um roteiro para ensaio: funções redefinidas em 27/11 (inclusive recebimentos e arredondamento de comissão) precisam ser conciliadas com as definições finais; não reverter correções posteriores. Backup verificável e ensaio numa cópia do estado real de produção ainda não foram realizados. Não remover políticas restritivas em produção como rollback improvisado; preservar segurança e usar recuperação revisada.

### Evidência de teste

[staff-branch-isolation-qa.sql](sql/staff-branch-isolation-qa.sql) aprovado em QA com três contas fictícias, matriz e filial. Proprietário consulta todos os clientes, inclusive central, atribui unidades e abre dois caixas. Gerente consulta e edita cliente da própria unidade; não vê a outra, não transfere registro para unidade não autorizada, não se autoatribui unidade e não consulta/fecha Caixa alheio. Recepção consulta somente sua unidade e seu Caixa; após revogação de atribuição perde acesso mesmo com claims antigas. Nenhum Caixa foi fechado indevidamente. Todos os registros revertidos. Testes de espera, pacotes, cancelamento de despesas, concorrência e reconciliação das definições finais permanecem pendentes. [SQL de pré-verificação](sql/staff-branch-release-preflight.sql) registra as consultas para repetir. Produção permanece inalterada.

## Homologação de operações por unidade e navegador

Teste transacional [staff-operations-qa.sql](sql/staff-operations-qa.sql) aprovado em QA, ampliando o cenário com proprietário, gerente, recepção, matriz e filial. Proprietário abriu dois caixas; gerente fechou o próprio com saldo esperado de R$ 100 e contado R$ 95 (diferença -R$ 5); recepção fechou o caixa atribuído com R$ 200 e diferença zero. Consulta e fechamento cruzados negados. Gerente cancelou despesa pendente própria, não cancelou a de outra filial; recepção não pôde cancelar a própria despesa. Pacote próprio criado com serviço da unidade; pacote de outra unidade, inclusão de serviço cruzado e criação por recepção negados. Lista de espera própria cadastrada e atualizada; consulta e alteração cruzadas negadas. Estados finais conferidos, transação revertida. Não cobre encaixe efetivo por disponibilidade publicada, pacote convertido em grupo de agendamentos, pagamento de despesa, concorrência real nem movimentações de caixa além da abertura e fechamento.

[Chromium aprovado](https://github.com/wiltonkru2030/salao-premium/actions/runs/45929727964) para a base `e83c578`: 90 cenários (15 estados/telas, três larguras, dois temas) sem falha no teste. [Artefato de capturas e relatório](https://github.com/wiltonkru2030/salao-premium/actions/runs/45929727964/artifacts/15168440866) gerado. O workflow usa views/CSS reais e dados sintéticos; não valida Auth real, fontes externas, acessibilidade integral ou qualidade estética por inspeção humana. Capturas ainda não inspecionadas individualmente. Resultado substitui o estado de falha do seletor anterior. Produção permanece inalterada.

Próxima revisão: reconciliar as definições financeiras finais (pagamentos parciais, arredondamento, estorno e escopo da unidade), testar concorrência e preparar backup/ensaio de recuperação antes da publicação. Não executar migrations antigas por cima de funções mais recentes.

## Proteção do repasse e devolução — QA

Migration `20261127024921_protect_commission_payout_unit_and_refund_lock.sql` aplicada somente em QA. Repasse por gerente requer unidade ativa atribuída, profissional com unidade fixa e cada comissão vinculada a recebimento confirmado da mesma unidade e item correspondente. Caixa central não serve de fallback para gerente. Casos legados sem origem demonstrável, profissionais sem unidade fixa ou transferidos são reservados a proprietário/admin/financeiro, decisão conservadora para evitar repasse cruzado. Método nulo é recusado. A devolução bloqueia as linhas de comissão em ordem determinística, como o repasse, antes de verificar status pago ou payout_id. Preserva o bloqueio de devolução após repasse: não implementa débito compensatório nem ajuste retroativo.

[Teste SQL](sql/commission-payout-isolation-qa.sql) aprovado e revertido: fluxo de R$70 em duas parcelas, estoque, comissão R$27, devolução antes de repasse, regressão de R$0,02 em dois pagamentos, comissão R$0,01; gerente de outra filial negado, gerente atribuído paga corretamente, repetição não cria novo repasse, devolução após repasse negada e pagamentos permanecem confirmados, notificação registrada. O teste é sequencial; não comprova corrida real entre transações. Ainda é necessário ensaiar concorrência de repasse/devolução/quitação, examinar ordem de bloqueio entre Caixa e comissões e tratamento de deadlock/retry, rateio de desconto entre vários itens e mudança de taxas durante pagamentos. Produção não alterada. Não reaplicar definições financeiras de novembro anteriores por cima desta versão.
