# App Profissional — SALÃO PREMIUM

Aplicação web/PWA em `/professional/`, integrada ao painel administrativo e ao Supabase. Revisão documental: 24/11/2026. Consulte o [README mestre](../README.md).

## Responsabilidade

Permitir que profissionais acompanhem agenda, atendimentos, comandas autorizadas, comissões próprias e configurações de perfil sem expor dados administrativos de outros profissionais, organizações ou filiais.

## Código e fronteiras

| Arquivo | Responsabilidade |
| --- | --- |
| app.js | Composição, ciclo de sessão, navegação e estado |
| auth.service.js | Autenticação CPF/e-mail e senha; confirma usuário no servidor |
| supabase.client.js | Cliente com armazenamento de sessão próprio |
| access.rules.js | Resolução de escopos, páginas, operações permitidas e resumo de comissão |
| agenda.controller.js | Eventos e seleção da Agenda |
| appointments.service.js | Consulta de agendamentos |
| orders.service.js | Consulta de comandas e itens |
| services.service.js | Catálogo de serviços permitido |
| order-service.controller.js | Registro de serviços em comanda conforme escopo |
| commissions.service.js | Lançamentos e pagamentos de comissão |
| views/ | Apresentação de login, calendário e workspace |
| utils/ | Formatação e regras puras |
| styles.css | Estilos do app, compartilhando identidade visual |

Manter arquivos pequenos, comentários/JSDoc, regras sem DOM, serviços sem HTML e erros em pt-BR. Consultas e cálculos críticos são validados no backend.

## Login e sessão

- CPF + senha é o fluxo principal solicitado. O código também aceita e-mail e senha.
- CPF usa a Edge Function `professional-cpf-login`; provisionamento e redefinição pelo painel usam `manage-professional-access`.
- Senha inicial controlada pela administração, alteração segura e revogação: homologar todos os fluxos. Não permitir recuperação por CPF isolado.
- Nunca registrar CPF, senha ou tokens em logs. Nunca criar tenant por login profissional.
- Usar sessão exclusiva; não importar o cliente pronto do painel. Limpar estado privado e descartar respostas antigas após logout/troca de conta.

## Permissões

`access.rules.js` implementa os escopos abaixo. UI não substitui RLS/RPC.

| Escopo | Páginas/limites |
| --- | --- |
| none | Sem acesso |
| self | Agenda própria, Comandas, Comissões próprias (com perfil vinculado) e Configurações |
| calendar_all | Agenda ampliada e Configurações, sem módulos financeiros |
| all | Agenda e Comandas; Comissões apenas se existir perfil profissional vinculado; Configurações |

Profissional exige membership ativo, perfil ativo e acesso habilitado. Outros papéis exigem concessão explícita de escopo; não elevar permissões automaticamente. O registro de serviço na comanda pelo profissional é limitado a escopo self, papel professional, perfil vinculado e comanda open/in_progress; o banco deve repetir a validação.

## Regras de negócio

- Agenda mensal com seleção do dia, horários, cliente, serviço, status e origem do agendamento. Mostrar somente o necessário ao papel e à unidade.
- Início/conclusão de atendimento e vínculo Agenda → Comanda devem respeitar conflitos e estados no servidor.
- Comanda restrita: registrar serviços permitidos sem liberar pagamentos ou gestão de caixa indevida; impedir edição/exclusão que comprometa recebimentos.
- Comissões: extrato de créditos, débitos, pendências e recebimentos, preservando centavos e históricos. O profissional não altera percentuais ou repasses por conta própria.
- Configurações de perfil conforme autorização. Não confundir acesso do proprietário ao painel com acesso ao PWA.

## Identidade visual

Fundo branco, preto/grafite, cinza discreto, dourado sutil, Poppins Medium e títulos Body Grotesque Fit quando disponível/licenciada. Ícones originais, máscaras globais, estados de loading/erro/vazio e controles acessíveis. Navegação sem reload integral; impedir envio repetido.

## Executar e testar

Na raiz do repositório:

```bash
npm run dev
npm run test:professional-utils
npm run test:professional-views
npm run test:professional-agenda-rules
npm run test:professional-agenda-view
npm run test:professional-agenda-controller
npm run test:professional-appointments-service
npm run test:professional-orders-service
npm run test:professional-order-items-service
npm run test:professional-commissions-service
npm run test:professional-access
npm run build
```

Abrir /professional/ no endereço Vite. Testar em QA com profissionais de dois tenants e duas filiais, recepção calendar_all, acesso revogado, senha inicial/redefinição, seleção de organização, tentativa de acesso cruzado, troca de sessão, atendimento e comissão. Validar interface em celular real. Não executar testes de escrita em produção.

## Situação

Arquivos e contratos localizados no Git, não homologados nesta revisão. Existência de código/testes não garante sucesso operacional. Atualizar este documento sempre que mudar regra, permissão ou integração.

## Retomada da meta aprovada — 26/11/2026

Perfil disponível na navegação, com Configurações acessíveis por ele. Para o papel professional, nome e telefone ficam somente para consulta na interface e o controlador não executa a antiga ação de edição. A proteção definitiva deve ser confirmada no banco. Busca instantânea nos serviços vinculados usa o filtro compartilhado. Ainda pendentes: Pix, e-mail e foto por URL com contratos seguros; CRUD e busca de clientes por unidade; cadastro rápido, histórico, CRUD/vínculos de serviços e homologação do fluxo de atendimento/comanda. Não considerar concluído sem testes e validação no navegador.

### Carteira profissional — consulta
A página Clientes usa a tabela de clientes sob RLS, restringida às unidades ativas acessíveis, e não mais o mês da Agenda. A ficha exibe até 50 atendimentos próprios nas unidades autorizadas. Cadastro, edição, inativação e seleção de cliente sem atendimento anterior na Agenda ainda exigem contratos seguros no servidor; não foram liberados por esta alteração. Teste: `npm run test:professional-customers-service`.

### Cadastro profissional — QA
Migration `20261127014207_professional_unit_customer_registration.sql` instalada em QA. RPCs privadas verificam usuário, profissional ativo e unidade principal ativa. Cadastro e edição de nome/telefone são restritos a essa unidade; não alteram identidade global nem RLS da carteira administrativa. Telefone duplicado bloqueado dentro do contrato (não é restrição única global). Interface habilitada somente com `VITE_PROFESSIONAL_CUSTOMER_REGISTRATION=true` após homologação. Teste negativo sem vínculo passou e acesso anônimo revogado; QA não possui profissional ativo, faltam testes positivos, de duplicidade e isolamento com contas reais/sintéticas. Produção não alterada. Inativação, unidades adicionais e integração direta com agendamento ficam pendentes.

### Agenda integrada à carteira — QA
Migration `20261127014343_professional_unit_direct_booking.sql` instalada em QA. O novo contrato agenda por ID do cliente ativo da unidade principal, com preço e duração do catálogo, fuso e validação de disponibilidade existentes. O modal pesquisa nome/telefone e serviço por nome/categoria/valor, permite cadastro rápido com seleção automática e preserva a hora e o serviço. Requer `VITE_PROFESSIONAL_BOOKING=true`, `VITE_PROFESSIONAL_CUSTOMER_REGISTRATION=true` e `VITE_PROFESSIONAL_UNIT_BOOKING=true`; sem a nova opção mantém o fluxo antigo. Teste negativo sem vínculo aprovado em QA; testes positivos, conflito, navegador e produção pendentes. Teste unitário: `npm run test:professional-booking-search`.

### Serviços — gerenciamento em QA
Migration `20261127014921_professional_unit_service_management.sql` instalada em QA. Cadastro de serviço na unidade gera vínculo próprio; edição exige autoria e ausência de outros profissionais vinculados. Serviços existentes podem ser vinculados/desvinculados pelo próprio profissional; remover vínculo não apaga o catálogo e é bloqueado quando há agendamento futuro ativo. Categoria, duração e preço validados no servidor. Ativar somente após homologação com `VITE_PROFESSIONAL_SERVICE_MANAGEMENT=true`. Testes negativos sem vínculo aprovados; testes positivos, concorrência, build e navegador pendentes. Produção não alterada. A inativação global permanece com o administrador. Teste unitário `npm run test:professional-services-service`.

### Atendimento individual — QA
Migration `20261127015204_professional_individual_attendance.sql` instalada em QA. Iniciar atendimento individual abre a comanda pelo contrato do painel e inclui o serviço agendado; o novo contrato verifica unidade principal, profissional, serviço e preço, e evita duplicar comanda em chamadas repetidas. Finalizar marca atendimento completed e comanda awaiting_payment sem gerar pagamento ou comissão. Comandas compartilhadas, agrupamentos e divergências de preço ficam com a recepção. Ativar somente após homologação com `VITE_PROFESSIONAL_ATTENDANCE=true`. Testes negativos de início/conclusão sem vínculo aprovados; positivos, concorrência, revisão do contrato legado de abertura, build, navegador e publicação em produção pendentes. Teste unitário: `npm run test:professional-attendance-service`.

### Gestão de comandas — QA
Migration `20261127020319_professional_order_item_management_guard.sql` instalada em QA. A API existente exige `can_edit_own_orders`, unidade ativa, comanda atribuída e sem movimentação financeira, e valida catálogo/estoque, quantidades e descontos. O gatilho antigo continua bloqueando escritas diretas de produto; autorizações temporárias privadas, por transação e item, permitem somente mutações verificadas pelo RPC. Serviço original do atendimento não pode ser removido. Cancelamento de comanda compartilhada ou concluída fica com recepção. Estoque efetivamente baixado no recebimento integral pelo fluxo de Caixa existente. Ativar após homologação com `VITE_PROFESSIONAL_ORDER_MANAGEMENT=true`. Teste negativo das seis operações aprovado. Testes positivos, concorrência, proteção de caminhos legados, build e navegador pendentes; produção não alterada. Teste unitário: `npm run test:professional-order-management`.

### Extrato de comissões
Consulta os tipos, descrições de itens sob RLS, IDs de repasse e referência do Caixa. A tela separa saldo geral de lançamentos filtrados; data civil no fuso do salão, filtros por situação/tipo e período, estornos, percentuais registrados e registro interno do repasse com comissões vinculadas. Não constitui comprovante bancário. Erros de leitura não impedem login nem exibem saldo falso; atualização ao abrir a página. Conferidos os campos e a FK em produção por consulta de metadados. O cálculo de recebimentos parciais e o pagamento pelo Caixa foram inspecionados em QA, sem alteração financeira. Faltam teste integrado com contas ativas, conciliação dos arredondamentos e taxas em pagamentos parciais, build e navegador. Teste: `npm run test:professional-commission-filters`.

### Perfil e Configurações — QA
Migration `20261127020921_professional_app_private_preferences.sql` instalada em QA. E-mail de contato no cadastro profissional não altera credenciais; foto por URL HTTPS, chave Pix declarada e preferências de notificações ficam restritas ao vínculo autenticado. Nome, telefone, unidade e comissão não são editados pelo formulário. A chave não é verificada e não aciona pagamento; integração administrativa de consulta de Pix permanece pendente. Preferências não são inscrições FCM. Ativar após homologação com `VITE_PROFESSIONAL_PROFILE_PREFERENCES=true`. Leitura/gravação sem vínculo negadas; testes positivos, máscaras dinâmicas para Pix, verificação de titularidade, confirmação de segurança Auth, build e navegador pendentes. Produção não alterada. Teste: `npm run test:professional-profile-preferences`.

### Notificações internas — QA
Migration `20261127021133_professional_notifications_inbox.sql` instalada em QA, dependente das preferências privadas. Gatilhos registram criação, transferência, confirmação, alteração de horário e cancelamento de agendamento, além de repasses. Apenas profissionais ativos, com vínculo e preferência habilitada recebem avisos; sem dados de cliente ou valores financeiros nas mensagens. Central mostra até 100 avisos recentes, contador global, filtro, marcação individual ou total e lembrete da próxima hora gerado sob demanda, sem duplicar por horário. Ativar após homologação com `VITE_PROFESSIONAL_NOTIFICATIONS=true`. Leitura e marcação sem vínculo negadas. Testes positivos, gatilhos, build, navegador e produção pendentes. FCM não configurado: Hosting não equivale a Messaging; sem envio em segundo plano. Teste: `npm run test:professional-notifications`.

### Revisão visual e atualização PWA
CSS organizado em entrada, layout, acabamento móvel e workspace; tokens globais preservados. Ajustados espaçamento, formulários, cartões, contraste nos dois temas, botão/ícone de Perfil e modal em uma coluna com campo apenas de hora. `hidden` vence flex/grid para impedir a exibição simultânea de formulários. CPF numérico recebe máscara sem alterar e-mail. Worker legado deixa de interceptar a rede e remove apenas caches do App Profissional; offline não é oferecido, para evitar conteúdo antigo e dados privados. Build passa a emitir worker, manifesto e ícone no caminho estável. Testes recentes incluídos no comando agregado. Teste estático `npm run test:professional-visual-contract`; build e revisão em navegador/dispositivo ainda necessários.

### Evidências de homologação
Build e suíte agregada aprovados em `d6f0e80`. Smoke SQL integrado de clientes, serviços, perfil, agenda, notificações e comanda aprovado em QA com rollback. Ver [relatório atualizado](../docs/HOMOLOGACAO-APP-PROFISSIONAL.md) para critérios restantes. Não habilitar flags em produção antes de concluir os bloqueios listados.

Homologação financeira complementar em QA: recebimento parcial/integral, comissão de serviço e produto, estoque, devolução antes de repasse e pagamento de comissão aprovados. Corrigido arredondamento cumulativo em QA. Ver relatório `docs/HOMOLOGACAO-APP-PROFISSIONAL.md`; produção permanece inalterada.

### Revisão de sessão e autenticação
Serviço de sessão separado do controlador: verificação de identidade, consulta de vínculos, classificação de acesso desativado/sem vínculo após autenticação, falha de conexão e limite de tentativas; erro de credencial continua genérico para evitar enumeração de CPF. Revalidação ao retornar ao aplicativo; logout externo limpa dados; mudança de salão remove estado anterior antes da consulta. Recuperação orienta administrador. A troca de salão não equivale a trocar filial: RPCs de escrita ainda restritos à unidade fixa. Troca inicial por `user_metadata` é apenas fluxo de interface, não garantia de segurança; migração para controle obrigatório do servidor e integração Auth real são bloqueios de publicação. Testes unitários adicionados; execução CI e navegador pendentes. Produção não alterada.

### Senha provisória e unidades — QA
Migration `20261127022502_professional_password_server_gate.sql` instalada em QA. Os quatro helpers de autorização profissional consultam marca administrativa e geração de JWT; teste transacional aprovado: metadado editável não libera Agenda, Clientes ou Atendimento, token antigo negado e nova geração autorizada. Contas legadas sem marcador conservam o comportamento anterior até migração coordenada. Código do provisionamento e nova Edge Function `complete-professional-password` preparados, não implantados: reautenticação por senha atual, tentativa de revogação global, atualização de senha e geração; exigem homologação Auth real e revisão de concorrência entre reset e conclusão. Não redefinir conta vinculada a outro salão. A seleção de unidades usa RLS e unidade ativa, filtra Agenda e Comandas, não altera vínculo. Comissões e demais consultas continuam no escopo original do salão; contratos de cadastro/agendamento para profissionais sem unidade fixa continuam pendentes. Teste unitário incluído no agregado; browser, isolamento de filiais, login real, migração de legados e produção pendentes.

### Refatoração estrutural — primeira etapa
Controladores de Clientes, Serviços, Notificações, Perfil, Financeiro e Atendimento isolados em `professional/controllers/`; composição visual da Agenda em `views/agenda-workspace.views.js`. Estado inicial e limpeza em `workspace-state.js`, incluindo campos dinâmicos, filtros e status. Bloqueio de mutação da Agenda por geração evita que operação antiga libere bloqueio de sessão nova. Teste `npm run test:professional-workspace-state` incluído na suíte. Sem alteração de contratos SQL, produção ou flags. A entrada caiu de 806 para 421 linhas; navegação, autenticação e composição ainda podem ser subdivididas. CI e navegador precisam confirmar regressões.

### Refatoração e carregamento sob demanda
Controladores de sessão e navegação separados. `app.js` agora tem 289 linhas. Entrada consulta Agenda; notificações em consulta separada após renderizar; Comandas, extrato, clientes e serviços são carregados ao abrir a página, ou catálogo ao abrir agendamento. Falhas de Agenda não encerram sessão válida e possuem recuperação; Comandas têm estado de carregamento/erro. Nenhum SQL/flag ou ambiente de produção alterado. Testes CI e medição real de desempenho no navegador pendentes.

Complemento: contador de notificações atualiza apenas o indicador no menu (sem reconstruir o modal aberto). Abertura da comanda diretamente pelo atendimento também carrega o catálogo. Detalhe selecionado na Agenda é conciliado com a resposta atual e ocultado durante falha ou carregamento. Testes de navegador continuam pendentes.

### Acabamento de campos e pesquisa
Máscaras Pix variáveis por tipo (CPF/CNPJ numéricos, telefone nacional, e-mail e UUID sem máscara fiscal), troca de tipo limpa o valor anterior, remoção explícita, rejeição de letras em chaves numéricas e DDI estrangeiro. O contrato atual não aceita CNPJ alfanumérico como chave Pix; validação de titularidade continua pendente. Pesquisa compartilhada por palavras sem acentos, telefone, valor, categoria e duração nos catálogos disponíveis. Foco visível, movimento reduzido, indicadores de perfil/configurações e anúncios de mensagens. Falha da suíte anterior: teste estático cliente/session-isolation.test.js ainda verificava app.js, atualizado para o controlador que contém o logout local; também corrigido logout legado sem escopo. Build e Agenda do commit anterior passaram; nova execução e navegador pendentes. Sem alteração SQL ou produção.

### Homologação visual automatizada
Revisão responsiva das telas: conteúdo centralizado, textos longos, filtros de comissão, detalhes da comanda, botões SVG de menu e telefones da Agenda. Workflow `Professional visual browser` usa Chromium e as views/CSS reais com dados sintéticos, sem conexão ao Supabase. 15 cenários × 3 larguras (320, 390, 1440 px) × 2 temas, 90 renderizações previstas; testa largura, erros JavaScript, formulários ocultos, menu móvel e máscara Pix; captura imagens e relatório JSON como artefato. Fontes externas bloqueadas no teste, com fallback local; não é aprovação estética manual nem teste autenticado. CI anterior `e70b8e9` passou Agenda e suíte geral. O novo workflow precisa ser executado e conferido; produção não alterada.

### Preparação da publicação — 26/11/2026
Agenda e validação geral aprovadas em `595349f`; teste visual falhou na instalação do Chromium (Ubuntu 26.04 incompatível). Runner fixado em Ubuntu 24.04. Inventário somente leitura identificou 9 migrations recentes só em QA, além de divergências de versões e definições. Consulte [critérios de publicação](../docs/PUBLICACAO-APP-PROFISSIONAL.md). Sem alteração de produção.
