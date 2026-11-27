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
