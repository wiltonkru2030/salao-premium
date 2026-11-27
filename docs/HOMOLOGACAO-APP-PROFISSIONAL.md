# Homologação do App Profissional — 26/11/2026

## Evidências verificadas

Base: commit `d6f0e8096a6be52d35e16ef776f2e38d7c610dd3`. GitHub Actions concluído com sucesso: [Agenda tests](https://github.com/wiltonkru2030/salao-premium/actions/runs/45927128106) e [App validation](https://github.com/wiltonkru2030/salao-premium/actions/runs/45927128001).

- Sintaxe JavaScript, build Vite das três entradas, auditoria CSS (3 entradas, 56 arquivos), suíte agregada e nove testes recentes: aprovados.
- Auditoria de estrutura: 391 arquivos, 416 funções exportadas documentadas, 32 sem JSDoc e 82 apontamentos. O relatório é informativo, não um certificado de conformidade. O app.js profissional tinha 718 linhas.
- QA Supabase: dois testes transacionais com contas e organizações fictícias, revertidos com ROLLBACK. Cadastro e consulta de cliente e serviço, vínculo e autorização de edição, preferências de perfil, rejeição de leitura cruzada, criação direta de agendamento e rejeição de conflito, notificação gerada e marcação de leitura aprovados.
- QA Supabase: início de atendimento e repetição sem nova comanda; inclusão, edição de quantidade/desconto e remoção de produto; conclusão em awaiting_payment, rejeição de cancelamento posterior, preservação de um item original e ausência de pagamento indevido: aprovados.
- Advisor de segurança QA: quatro avisos INFO para tabelas privadas com RLS ativo e sem políticas diretas (preferências, notificações, autorização temporária de itens e autoria de serviços). Acesso direto intencionalmente revogado; não confundir com auditoria de segurança completa.

## Reprodução

O script [professional-qa-smoke.sql](sql/professional-qa-smoke.sql) reúne os cenários em uma única transação, também executada com sucesso em QA. Executar somente em QA isolado, com migrations recentes aplicadas, em sessão administrativa que permita simular o papel authenticated. O script não deve ser executado em produção. Em caso de erro, encerrar a transação com ROLLBACK. Não utiliza cadastro real.

## Bloqueios de publicação

1. Validar fluxo de autenticação real, revogação, troca de senha e sessão, inclusive credenciais provisórias.
2. Testar isolamento de dois profissionais ativos na mesma organização e entre unidades, concorrência real, disponibilidade/bloqueios, cancelamentos e caminhos legados.
3. Homologar pagamentos parciais e integrais, comissões de serviço/produto, estoque, repasses e estornos no Caixa, inclusive arredondamento.
4. Revisar todas as telas em navegador autenticado e dispositivo móvel, tema claro/escuro, acessibilidade, máscaras e sugestões. Refatorar app.js e demais achados de estrutura.
5. Completar troca de unidade, máscaras Pix, consulta administrativa da chave, FCM e lembretes em segundo plano. Não declarar notificações push disponíveis.
6. Comparar migrations reais de QA e produção, backup e estratégia de rollback. Só liberar as flags após verificação de schema e testes. Nenhuma alteração de produção foi realizada nesta homologação.

A aprovação de build e smoke SQL não equivale à aprovação comercial ou a um deploy.

## Homologação financeira complementar — 26/11/2026

Em QA, com contas fictícias de proprietário e profissional e rollback: comanda de R$ 70 (serviço R$ 50 a 50%, produto R$ 20 a 10%), parcial de R$ 25 e quitação de R$ 45. Comissão parcial R$ 8,93 de serviço e R$ 0,71 de produto; total R$ 27. Entradas de R$ 70; estoque 10 → 9 na quitação, retorna a 10 na devolução; saída de R$ 70 e comissões canceladas. Profissional sem autorização de Caixa não consegue receber. Detectada divergência de arredondamento: R$ 0,02 a 50% em duas parcelas de R$ 0,01 gerava R$ 0,02. Migration `20261127021953_cumulative_partial_commission_rounding.sql` instalada em QA: cálculo cumulativo por item e taxa, sem alterar lançamentos históricos; novo teste retorna R$ 0,01 e repasse gera saída e aviso. Devolução após repasse permanece bloqueada no contrato de QA (não equivale a homologar reversão pós-repasse). Script `docs/sql/professional-financial-qa.sql` aprovado. Pendentes: conciliação histórica, taxa alterada entre parcelas, concorrência real, reversões após repasse, fechamento do Caixa, descontos complexos, comparação das funções de produção e homologação visual. Nenhuma alteração de produção.

### Revisão de sessão e autenticação
Serviço de sessão separado do controlador: verificação de identidade, consulta de vínculos, classificação de acesso desativado/sem vínculo após autenticação, falha de conexão e limite de tentativas; erro de credencial continua genérico para evitar enumeração de CPF. Revalidação ao retornar ao aplicativo; logout externo limpa dados; mudança de salão remove estado anterior antes da consulta. Recuperação orienta administrador. A troca de salão não equivale a trocar filial: RPCs de escrita ainda restritos à unidade fixa. Troca inicial por `user_metadata` é apenas fluxo de interface, não garantia de segurança; migração para controle obrigatório do servidor e integração Auth real são bloqueios de publicação. Testes unitários adicionados; execução CI e navegador pendentes. Produção não alterada.

Teste QA adicional aprovado com JWT simulado mantido: revogação de acesso bloqueia leitura de agenda e serviços, RPCs de clientes/notificações; perda de vínculo bloqueia agenda e perfil. Transação revertida; não é teste de login real.

### Senha provisória e unidades — QA
Migration `20261127022502_professional_password_server_gate.sql` instalada em QA. Os quatro helpers de autorização profissional consultam marca administrativa e geração de JWT; teste transacional aprovado: metadado editável não libera Agenda, Clientes ou Atendimento, token antigo negado e nova geração autorizada. Contas legadas sem marcador conservam o comportamento anterior até migração coordenada. Código do provisionamento e nova Edge Function `complete-professional-password` preparados, não implantados: reautenticação por senha atual, tentativa de revogação global, atualização de senha e geração; exigem homologação Auth real e revisão de concorrência entre reset e conclusão. Não redefinir conta vinculada a outro salão. A seleção de unidades usa RLS e unidade ativa, filtra Agenda e Comandas, não altera vínculo. Comissões e demais consultas continuam no escopo original do salão; contratos de cadastro/agendamento para profissionais sem unidade fixa continuam pendentes. Teste unitário incluído no agregado; browser, isolamento de filiais, login real, migração de legados e produção pendentes.

### Refatoração estrutural — primeira etapa
Controladores de Clientes, Serviços, Notificações, Perfil, Financeiro e Atendimento isolados em `professional/controllers/`; composição visual da Agenda em `views/agenda-workspace.views.js`. Estado inicial e limpeza em `workspace-state.js`, incluindo campos dinâmicos, filtros e status. Bloqueio de mutação da Agenda por geração evita que operação antiga libere bloqueio de sessão nova. Teste `npm run test:professional-workspace-state` incluído na suíte. Sem alteração de contratos SQL, produção ou flags. A entrada caiu de 806 para 421 linhas; navegação, autenticação e composição ainda podem ser subdivididas. CI e navegador precisam confirmar regressões.

### Refatoração e carregamento sob demanda
Controladores de sessão e navegação separados. `app.js` agora tem 289 linhas. Entrada consulta Agenda; notificações em consulta separada após renderizar; Comandas, extrato, clientes e serviços são carregados ao abrir a página, ou catálogo ao abrir agendamento. Falhas de Agenda não encerram sessão válida e possuem recuperação; Comandas têm estado de carregamento/erro. Nenhum SQL/flag ou ambiente de produção alterado. Testes CI e medição real de desempenho no navegador pendentes.

Complemento da refatoração: contador atualizado sem reconstrução do modal, catálogo também carregado pelo fluxo direto de atendimento, detalhe conciliado com a Agenda atual. CI pendente.

### Acabamento de campos e pesquisa
Máscaras Pix variáveis por tipo (CPF/CNPJ numéricos, telefone nacional, e-mail e UUID sem máscara fiscal), troca de tipo limpa o valor anterior, remoção explícita, rejeição de letras em chaves numéricas e DDI estrangeiro. O contrato atual não aceita CNPJ alfanumérico como chave Pix; validação de titularidade continua pendente. Pesquisa compartilhada por palavras sem acentos, telefone, valor, categoria e duração nos catálogos disponíveis. Foco visível, movimento reduzido, indicadores de perfil/configurações e anúncios de mensagens. Falha da suíte anterior: teste estático cliente/session-isolation.test.js ainda verificava app.js, atualizado para o controlador que contém o logout local; também corrigido logout legado sem escopo. Build e Agenda do commit anterior passaram; nova execução e navegador pendentes. Sem alteração SQL ou produção.
