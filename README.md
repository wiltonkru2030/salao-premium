# SALÃO PREMIUM

**SaaS brasileiro de gestão de salões de beleza, profissionais e clientes.**

Painel administrativo, App Profissional e Área da Cliente integrados ao mesmo domínio de negócio, com separação de sessão, organização e unidade. O objetivo é entregar uma experiência rápida, segura, acessível, comercial e integralmente em português do Brasil.

**Revisão documental:** 24/11/2026 · **Branch:** `main` · **Situação:** desenvolvimento e homologação; não declarar pronto para produção sem os critérios de aceite deste documento.

> Este README é o contrato mestre do projeto. Ele distingue funcionalidades encontradas no código, requisitos obrigatórios e validações ainda necessárias. Documentos antigos ou SQL de referência não prevalecem sobre migrations efetivamente versionadas, código atual e verificações do ambiente. Existência de código ou teste não significa aprovação operacional.

## Índice

- [Aplicações e tecnologias](#aplicações-e-tecnologias)
- [Executar localmente](#executar-localmente)
- [Arquitetura e organização do código](#arquitetura-e-organização-do-código)
- [Identidade visual e experiência](#identidade-visual-e-experiência)
- [Módulos e regras de negócio](#módulos-e-regras-de-negócio)
- [Aplicativo profissional](#aplicativo-profissional)
- [Aplicativo da cliente](#aplicativo-da-cliente)
- [Segurança e banco de dados](#segurança-e-banco-de-dados)
- [Desempenho e confiabilidade](#desempenho-e-confiabilidade)
- [Testes e auditorias](#testes-e-auditorias)
- [Situação e critérios de entrega](#situação-e-critérios-de-entrega)
- [Documentação técnica](#documentação-técnica)

## Aplicações e tecnologias

| Aplicação | Entrada | Responsabilidade |
| --- | --- | --- |
| Painel / App do Salão | `/` | Gestão administrativa e operação por perfil |
| App Profissional (PWA) | `/professional/` | Agenda, atendimentos, comandas permitidas, comissões e perfil |
| Área da Cliente | `/cliente/` | Identidade global, descoberta de salões, reservas e relacionamento |

O build multipágina em [vite.config.js](vite.config.js) possui três entradas. Um quarto aplicativo nativo independente não está comprovado; o painel deve atender também ao salão em dispositivos móveis.

- Front-end: JavaScript ES Modules, HTML, CSS, Vite 6; contratos JSDoc e declarações TypeScript quando pertinentes.
- Backend: Supabase Auth, PostgreSQL, RLS, RPCs, triggers e Edge Functions.
- Repositório único com aplicações e módulos compartilhados (monorepo organizacional, não necessariamente npm workspaces).
- Infraestrutura inicial: priorizar o plano gratuito do Supabase quando suficiente; não depender de Cloudflare, Prisma, SMS ou WhatsApp OTP para o funcionamento básico. Avaliar custos, limites e capacidade antes de escalar.
- Idioma padrão: pt-BR; moeda BRL; datas, telefones, documentos e fuso da unidade tratados corretamente.

## Executar localmente

Pré-requisito declarado em [package.json](package.json): Node.js 20 ou superior; npm e Git.

```bash
git clone https://github.com/wiltonkru2030/salao-premium.git
cd salao-premium
npm install
npm run dev
```

Abra o endereço informado pelo Vite (normalmente http://localhost:5173). Para o profissional, acrescente `/professional/`; para a cliente, `/cliente/`.

```bash
npm run build
```

A configuração do cliente Supabase está em `src/supabase/`, com clientes próprios nas aplicações. Use um ambiente de desenvolvimento/homologação e contas de teste autorizadas; confira a configuração antes de gravar dados. Nunca publicar senhas de teste reais, tokens, chaves privadas ou service_role. A chave publicável não substitui RLS. Google OAuth e Passkey exigem configuração de domínio, redirects e provedor; HTTPS no ambiente publicado. Não há URL de produção homologada declarada aqui.

## Arquitetura e organização do código

```text
salao-premium/
├── index.html / app.js / styles.css
├── vite.config.js / package.json
├── src/
│   ├── app.js           # bootstrap, sessão e contexto
│   ├── auth/            # autenticação, tenant e revisão de sessão
│   ├── layout/          # shell, navegação e composição das páginas
│   ├── components/      # componentes compartilhados
│   ├── pages/           # páginas/adaptadores, inclusive legados
│   ├── modules/         # domínios administrativos
│   ├── agenda/          # calendário, serviços, componentes e controladores
│   ├── supabase/        # cliente e configuração publicável
│   ├── styles/          # design system e composição
│   ├── types/           # contratos e declarações
│   └── utils/           # máscaras, validação, erros
├── professional/        # app profissional e serviços próprios
├── cliente/             # app cliente, services/, ui/, styles/, utils/
├── brand/               # identidade visual, logos e ícones
├── supabase/
│   ├── migrations/      # histórico SQL incremental
│   └── functions/       # Edge Functions
├── docs/                # contratos técnicos, SQL e histórico
├── scripts/             # auditorias e manutenção
└── tests/               # integração
```

Mapa de responsabilidades, não inventário exaustivo de arquivos. Ver [guia do código](docs/GUIA-DO-CODIGO.md) e [arquitetura](docs/ARCHITECTURE.md).

### Padrão obrigatório para qualquer alteração

1. Separar marcação/apresentação, estilos CSS, eventos/controladores, regras de negócio, serviços, consultas/repositórios, tipos, utilitários e testes. Views não consultam o banco; serviços não montam HTML; regras puras não manipulam DOM.
2. Arquivos pequenos e coesos; aproximadamente 300 linhas como ponto de revisão, não motivo para fragmentar código trivial. Evitar linhas gigantes (auditoria sinaliza acima de 400 caracteres). Migrar adaptadores legados sem quebrar rotas.
3. Todo arquivo novo ou editado deve ter descrição inicial da responsabilidade. Funções importantes/exportadas devem ter JSDoc explicando propósito, parâmetros, retorno, dependências, validações, erros, efeitos colaterais e, quando aplicável, tabelas, RPCs, tenant, filial e permissões. CSS, HTML e SQL também precisam de comentários úteis e adequados à linguagem.
4. Não criar duplicações de regras, CSS, máscaras ou tratamento de erros. Reutilizar contratos compartilhados; não introduzir dependências desnecessárias.
5. Cada módulo deve ter documentação de fluxo, contratos, permissões e testes. Alterar README/docs junto com mudanças funcionais; registrar riscos e limitações.
6. Usar mensagens pt-BR seguras em todos os fluxos. Tratar falhas, timeout, sessão expirada, concorrência, respostas inválidas, estados vazios e indisponibilidade. Nunca simular sucesso ou usar dados fictícios em telas reais.
7. Antes de integrar alterações à main, revisar diff, executar testes pertinentes, build, auditorias e documentar resultados reais. Não modificar dados de produção para fazer teste passar.

## Identidade visual e experiência

A identidade oficial é branca, com preto/grafite, cinza discreto e dourado sutil. Títulos: Body Grotesque Fit quando a fonte licenciada estiver disponível; interface: Poppins Medium, com fallback consistente. Logos e ícones SVG originais, transparentes e otimizados; preservar versões oficiais da marca.

- CSS global obrigatório: `styles.css` agrega as folhas do painel; `src/styles/design-system.css` é a camada final. Tokens de cor, fontes, foco, bordas, sombras, espaçamento e altura de controles compartilhados.
- Botões, inputs, selects, listas, cards, badges de status, avisos, modais, drawers, navegação e loading devem obedecer à mesma identidade nas três aplicações; estilos locais apenas para composição específica.
- Menu lateral recolhível no desktop, navegação responsiva no mobile, acessibilidade por teclado, foco visível, rótulos e áreas de toque adequadas.
- Preferir listas visuais e cartões, não grids administrativos clássicos; calendário e relatórios podem exigir representação tabular apropriada. Detalhes em drawer/modal; todos os cadastros devem oferecer modal padronizado e ações de criação, edição e inativação/exclusão conforme permissões.
- Abrir tela imediatamente na navegação interna, sem recarregar a página inteira; spinner discreto durante busca, estados vazio/erro e tentativa novamente. Desabilitar envio duplicado.
- Máscaras compartilhadas em CPF/CNPJ, telefone/WhatsApp, CEP e valores; normalizar dados e validar no servidor. Datas em formato brasileiro, seleção PF/PJ/MEI conforme cadastro, consulta automática de CEP com fallback manual. Nunca aplicar máscara fiscal a e-mail/senha.

A existência do design system e das máscaras globais está confirmada no código. Cobertura integral de todas as telas, fontes, ícones, modais, campos e ações ainda exige inspeção real. Ver [design system](docs/DESIGN_SYSTEM.md).

## Módulos e regras de negócio

As rotas administrativas foram identificadas em [src/layout/render.js](src/layout/render.js); regras abaixo combinam implementação localizada e requisitos obrigatórios. Não representam aceite de cada operação.

### Dashboard e cadastros

- Dashboard com indicadores reais, filtros pertinentes, organização/unidade e estados de carregamento; sem números inventados.
- Clientes: cadastro, edição, pesquisa, contato, histórico e vínculo controlado com a identidade global. Cadastro rápido pelo nome e WhatsApp em orçamento/agenda quando necessário. Não unir cadastros pelo telefone sem confirmação.
- Profissionais: dados PF/PJ/MEI, documento, telefone, endereço, foto, unidade, serviços habilitados, expediente, bloqueios, comissão por serviço e gestão de acesso; edição e inativação seguras.
- Serviços: nome, categoria, preço, duração, descrição, imagem, profissionais habilitados, disponibilidade por unidade, desconto e comissão aplicáveis.
- Produtos e estoque: cadastro/edição, categorias, preços, quantidade, unidade e regra de comissão. Baixa e reversão precisam seguir a transação financeira, evitando estoque negativo ou duplicado.
- Categorias: organização do catálogo com integridade referencial; preservar itens históricos.

### Matriz, filiais, equipe e configurações

- Cada empresa/tenant deve nascer com uma única matriz, inclusive salão independente; filiais adicionais representam unidades físicas da mesma organização. Não criar nova identidade global para cada filial.
- Cadastro do salão: nome, CPF/CNPJ, e-mail/senha do proprietário, telefone, endereço/CEP, logo, perfil comercial e catálogo de serviços.
- Seletor de organização para memberships múltiplos; seletor de unidade para rede de filiais e visão consolidada somente quando autorizada. Selecionar explicitamente a filial para operações financeiras.
- Cada unidade deve ter vitrine própria, endereço, catálogo, profissionais, horário, link/slug público e publicação opt-in. Validação de link e fluxo completo de publicação é critério de homologação.
- Equipe e permissões por vínculo ativo, papel e escopo de profissional/filial. Proprietário/admin com acesso de gestão; gerente/recepção conforme autorização; profissional restrito; cliente independente.
- Configurações centralizam regras comerciais, identidade, publicação, descontos, comissão, usuários e unidades conforme permissões. Nunca confiar em seleção visual como autorização.

**Atenção a login/menu:** o código atual restringe o papel `professional` às páginas Agenda, Comanda, Comissões e Configurações. Se uma conta de proprietário mostrar apenas essas páginas, investigar membership, organização e sessão ativos; não remover a barreira de autorização nem alterar cadastros reais para mascarar o problema.

### Agenda

- Calendário dia/semana/mês com régua lateral de horários, profissionais no topo (nome/foto), filtros, duração automática, detalhe e estados do atendimento.
- Agendar, editar, arrastar/reagendar, cancelar, registrar falta, iniciar e concluir atendimento, respeitando horário de expediente, intervalos, folgas, almoço, cursos e bloqueios.
- Estados coerentes (confirmado, cancelado, falta, em atendimento, concluído e demais estados definidos pelo domínio). Mostrar origem salão/cliente/profissional.
- Verificar conflitos de horário, profissional habilitado, organização, filial e duração no servidor; impedir sobreposição inclusive em reservas concorrentes.
- Grupo de serviços mantém cada profissional responsável; início do atendimento pode abrir Comanda agrupada por RPC atômica; não duplicar registros em reenvio.
- **Fila de espera e encaixes:** cadastrar solicitação, pesquisar horários livres, controlar status, converter em reserva transacional e liberar vaga quando aplicável. Serviços e migrations versionados em 20/11; validar corrida por vaga e cancelamento.
- **Pacotes/combos:** catálogo de pacotes e itens, ativação e regras por unidade; não prometer créditos/resgates automáticos que ainda não tenham contrato validado.

### Comanda, vendas e estoque

Comanda é o registro operacional do atendimento: adiciona serviços e produtos, preserva cliente, unidade, profissional opcional quando a regra permitir, preço, desconto e quantidade. Permite edição, remoção de itens e cancelamento antes dos limites financeiros. Não é um Caixa paralelo.

- Comanda aberta permite incluir itens conforme permissão. A regra documentada bloqueia editar/excluir após primeiro pagamento confirmado, para preservar histórico. Qualquer flexibilização solicitada deve usar ajuste transacional, nunca sobrescrever valores recebidos.
- Caixa é responsável por recebimentos parciais/totais e edição operacional autorizada antes do pagamento; saldo calculado pelo backend, sem recebimento acima do saldo.
- Na quitação, vincular venda, baixa de estoque e registros financeiros de forma consistente e idempotente.
- Cancelamento sem pagamento não gera estorno. Com recebimentos parciais, exigir estorno integral confirmado, saídas de Caixa e reversão de comissões pendentes. Venda fechada e comissão já paga exigem fluxo explícito de ajuste/reembolso; não presumir que está homologado.

### Caixa, Financeiro, Despesas e Relatórios

- Abertura com saldo inicial, entradas, saídas, despesas, pagamentos, estornos, reembolsos autorizados, pagamentos de comissão, fechamento e conferência.
- Caixa central ou por filial: serviço atual usa `open_cash_register_for_branch`; fechamento e resumo por RPC; conferir dinheiro físico separadamente dos demais meios de pagamento.
- Operações críticas com caixa aberto correto, valor em centavos, concorrência controlada, referência à origem e trilha de auditoria.
- Financeiro, Vendas, Despesas e Relatórios: consultas reais, filtros por período e escopo, paginação, totais agregados no servidor, sem confundir receita, dinheiro físico, saldo e comissão.
- Não apagar movimento para corrigir saldo. Ajustes devem ser lançados de forma rastreável.

### Comissões

- Percentual padrão e específico por profissional + serviço (ex.: Corte 50%, Progressiva 40%); configuração de produto comissionável pelo salão, com profissional vinculado.
- Gerar proporcionalmente ao valor efetivamente recebido: serviço de R$ 200 com taxa de 50% e pagamento parcial de R$ 100 gera R$ 50 de comissão. Pagamento final apenas completa o saldo.
- Preservar base, percentual aplicado (snapshot quando suportado), item, pagamento, profissional, filial, status e histórico. Não recalcular passado com taxa nova.
- Pendentes/pagas, filtro e pagamento selecionado por profissional. Pagamento cria saída correspondente no Caixa; não pagar duas vezes.
- Estorno de comissão pendente e ajuste de comissão paga devem ser explícitos e auditáveis.

### Orçamentos

- Cliente existente ou cadastro rápido, múltiplos serviços e produtos, quantidades, preços, validade, observações, profissional sugerido/definido por serviço.
- Desconto em percentual ou valor, limitado pelas regras do salão e serviços elegíveis; calcular e validar pelo backend.
- Status em análise/pendente, aceito, recusado e outros previstos. Somente aceito pode virar agendamento; preservar vínculos e criar grupo/slots por profissional sem conflito.
- Documento com logo quando disponível, nome, endereço, CPF/CNPJ e dados comerciais. O código atual gera documento imprimível via navegador (Salvar como PDF), com link de resposta protegido por token; WhatsApp abre mensagem preparada, com anexo manual do PDF.
- Confirmar cobertura efetiva de produtos no orçamento e cadastro rápido, qualidade do PDF, desconto e agendamento de múltiplos profissionais antes do aceite.

### Cupons e recuperação

- Cupons por salão, filial, serviço, validade e condições; desconto recalculado no backend; uso reservado/confirmado transacionalmente, sem reutilização indevida.
- Recuperar/lixeira: manter registros de exclusão, quem realizou, data/hora, identificador, dados necessários à recuperação e política de retenção. Restaurar apenas com autorização e integridade; não confundir trilha de auditoria com backup completo.

## Aplicativo profissional

Entrada `/professional/`. Código próprio em `professional/`; serviços, views, regras e sessão isolados.

- Login principal solicitado por CPF e senha, provisionamento/redefinição pelo administrador; código também oferece login por e-mail. Validar credencial no servidor, não expor CPF/senha nos logs.
- Senha inicial controlada pelo administrador e fluxo de alteração segura; revogação deve bloquear acesso. Não criar tenant ao autenticar profissional.
- Agenda mensal, seleção do dia, atendimentos do próprio escopo, status, origem e dados estritamente necessários. Agenda ampliada somente com autorização explícita.
- Comandas/atendimentos conforme configuração restrita, sem acesso financeiro administrativo indevido. Comissões próprias e histórico de pagamentos.
- Perfis, configurações e permissões validadas no banco; limpeza de estado privado ao encerrar/trocar sessão. PWA responsiva, sem cache de dados privados acessível a outra conta.
- Homologar CPF, senha inicial, redefinição, revogação, edição de profissional, escopo por filial, acesso limitado, início/fim de atendimento e comissão.

## Aplicativo da cliente

Entrada `/cliente/`. Uma conta global para utilizar diferentes salões, sem compartilhar dados operacionais entre eles.

- Google OAuth e Passkey: serviços de autenticação presentes. Requerem configuração e teste em navegador/dispositivo real. PIN local de 4 dígitos é requisito de desbloqueio após autenticação forte, não senha de servidor, prova de telefone, recuperação de conta ou autenticação independente. Não afirmar que PIN está pronto. Sem dependência de OTP pago por SMS/WhatsApp.
- Interface simples, inclusive para clientes idosos: login acessível, textos claros, navegação inferior, perfil, agendamentos, busca e detalhes.
- Perfil global, nome e celular normalizado; telefone não verificado não prova posse. Modelo `customer_profiles`, `customer_tenant_memberships` e `customer_account_customers`; associação de cadastro antigo com confirmação, sem merge automático.
- Descoberta por nome, cidade/UF ou GPS mediante ação explícita; somente salões/unidades publicados. Vitrine, catálogo, profissionais ativos, serviços, preços, duração e horários disponíveis.
- Reserva com HOLD temporário, validade, confirmação/cancelamento e validação concorrente no banco. Histórico, cancelamento/remarcação conforme regras, cupom e desconto recalculados. Seleção de vários serviços em uma reserva ainda requer validação/implementação.
- Favoritos, notificações internas, preferências e fidelidade: código presente; indicadores de atendimentos concluídos, comandas pagas e total pago por salão. Não confundir indicadores com programa de pontos/resgate.
- Migrations de identidade, diretório, disponibilidade, cupons, histórico, favoritos/preferências, notificações e fidelidade constam no inventário versionado de 20/11; homologação de Google/Passkey, publicação e reservas ponta a ponta continua obrigatória.
- Não expor endereço privado da cliente, localização sem consentimento ou dados de outros clientes. Troca de conta deve limpar estado e impedir respostas antigas de aparecerem na sessão nova.

Consulte [cliente/README.md](cliente/README.md), observando que suas referências a SQL ainda não aplicado podem estar desatualizadas em relação ao inventário e migrations de 20/11.

## Segurança e banco de dados

- Uma organização é a fronteira de isolamento (`org_id`); filial (`branch_id`) e profissional delimitam acesso adicional. Identidade Auth não substitui membership. Vínculos cruzados devem ser bloqueados por FK composta, constraints ou validações transacionais.
- RLS em tabelas expostas de dados privados; SELECT, INSERT, UPDATE e DELETE devem validar identidade, papel e escopo; UPDATE com USING e WITH CHECK. Filtros no JavaScript são úteis, mas não são segurança.
- RPCs validam `auth.uid()`, papel, organização, filial, propriedade e estado da operação; IDs fornecidos pelo cliente não são prova de acesso. Funções privilegiadas em schema privado, search_path seguro e grants mínimos; não autorizar por user_metadata.
- Chaves públicas somente no front-end; segredos em ambiente protegido/Vault quando aplicável. TLS em trânsito, proteção de dados em repouso e acesso mínimo; não declarar criptografia ponta a ponta sem implementação verificável.
- Autenticação separada entre aplicações; rotacionar/renovar sessão com segurança, prevenir sessão antiga e vazamentos de cache, validar logout e recuperação. Proteções contra XSS, abuso, tentativa repetida, exposição de tokens e injeção.
- Registro de criação, alteração e exclusão com timestamps, ator, tenant e dados necessários; movimentos financeiros preservados. Política de retenção, backup e restauração testados. LGPD: minimização, finalidade, consentimento quando aplicável e atendimento aos direitos do titular; não declarar conformidade certificada.
- Erros: `src/utils/errors.js` centraliza tradução, relatório sanitizado e captura global no painel; identificador SP para suporte quando aplicável. Não logar senha, CPF/CNPJ, JWT, SQL bruto, tokens ou dados bancários. Auditar também mensagens locais e os dois apps.

### Histórico de migrations

O [inventário remoto capturado em 20/11/2026](docs/migrations/remote-history-2026-11-20.json) contém 97 versões. Esse número é histórico, não consulta ao banco em tempo real. [docs/MIGRATIONS.md](docs/MIGRATIONS.md) registra divergências anteriores; não tratar números de 13/11 como atuais.

As migrations e testes estáticos mais recentes cobrem, entre outros, catálogo por filial, caixa por filial, vitrine, cupons, centavos, pacotes, fila de espera, fidelidade e índices. SQL em `docs/sql/` é referência/teste/rascunho, não instrução de deploy; verificar se a versão equivalente foi aplicada. O modelo antigo de conta por marca em `docs/sql/cliente-identidade-marca.sql` está obsoleto e não deve ser aplicado.

Nunca resetar, truncar, apagar registros ou reparar histórico de produção para corrigir erros. Antes de deploy de schema, comparar histórico local e remoto atualizado, validar dependências e replay em banco isolado, revisar backup e planejar rollback. Não usar db push às cegas.

## Desempenho e confiabilidade

- Consultas com escopo obrigatório, seleção apenas de colunas necessárias, índices alinhados aos filtros, paginação e agregação no banco; evitar SELECT indiscriminado, N+1, cargas integrais e assinaturas duplicadas.
- Navegação interna rápida sem reload, fetch por módulo, requisições independentes em paralelo quando seguro, cancelamento ou descarte de respostas antigas, cache isolado por usuário/tenant/filial.
- Login preserva sessão válida sem ciclos desnecessários de autenticação. Não deixar spinner infinito; falhas retornam estado de erro e ação de tentar novamente.
- Financeiro, reserva e estoque com transações e idempotência, locks/constraints onde necessários. Evitar cálculos divergentes entre front-end e backend.
- Monitorar latência, erros, consultas lentas, capacidade e concorrência antes de aumentar infraestrutura. Uma base PostgreSQL bem dimensionada e isolada é a estratégia inicial; segundo banco não é solução automática para lentidão.
- Medir com dados e carga representativos: tempo de login, primeira renderização, agenda, paginação, reserva simultânea, pagamento e troca de filial. Nenhum SLA ou capacidade de usuários simultâneos foi comprovado nesta revisão.

## Testes e auditorias

Scripts reais declarados em [package.json](package.json):

| Comando | Finalidade |
| --- | --- |
| `npm run build` | Build Vite das três entradas |
| `npm run test:all` | Suíte agregada de testes estáticos/unitários e auditoria de estrutura |
| `npm run test:agenda` | Calendário, consultas, bloqueios e vínculo com Comanda |
| `npm run test:availability` | Disponibilidade |
| `npm run test:comanda` / `npm run test:cash` | Regras de pagamento e operação |
| `npm run test:quotes` / `npm run test:quote-rules` | Orçamento |
| `npm run test:tenant` | Sessão, tenant e papel |
| `npm run test:utils` / `npm run test:errors` | Máscaras e erros |
| `npm run test:customer-auth` / `npm run test:customer-services` | App cliente |
| `npm run test:professional-views` / `npm run test:professional-access` | App profissional |
| `npm run test:agenda-offers` / `npm run test:customer-loyalty` | Fila de espera, pacotes e fidelidade |
| `npm run test:design-system` / `npm run audit:css` | Design system e imports CSS |
| `npm run audit:structure` | Comentários/JSDoc, tamanho de arquivos e linhas; relatório de achados |
| `npm run audit:migrations` | Compara versões locais com inventário; não conecta ao banco |
| `npm run test:integration:backend` | Integração backend em QA autorizado |
| `npm run test:customer-rls` | Isolamento de identidade global com usuários de QA |

Use scripts específicos de catálogo, profissionais, equipe, filiais, financeiro, comissões, cupons e contratos SQL disponíveis no package.json. A suíte agregada não substitui os testes de integração separados nem todas as auditorias.

Não executar integração que cria/altera registros em produção. Leia os scripts em `tests/integration/`, configure ambiente isolado e usuários autorizados, e registre comandos, resultados, commit e data. Testes de regex/contrato SQL não provam execução SQL nem segurança real. Esta revisão documental não executou os testes.

## Situação e critérios de entrega

**Legenda:** código localizado = há evidência no repositório; homologação = verificar funcionamento em navegador e banco de QA; requisito = deve ser entregue, mas cobertura não comprovada.

| Área | Evidência encontrada | Condição para aceite |
| --- | --- | --- |
| Painel administrativo | Rotas e serviços, sessão e seleção de unidade | Proprietário acessa todos os módulos; cadastros editáveis e sem regressões |
| Agenda / Comanda | Controladores, serviços, testes e contratos SQL | Ciclo completo, múltiplos profissionais, conflitos e pagamentos |
| Caixa / Comissões | RPCs e serviços; caixa por filial e resumo | Conferência, centavos, estornos e comissão paga sem divergência |
| Orçamentos | Componentes e fluxo imprimível/agendamento | Produtos, cadastro rápido, PDF, WhatsApp e grupo validados |
| Filiais / catálogo | Serviços e migrations versionadas | Matriz única, isolamento, vitrine e links por unidade |
| App Profissional | App, login CPF/e-mail, regras e testes | Provisionamento, revogação, sessão e escopo restrito |
| App Cliente | App, serviços, views e migrations | OAuth/Passkey, PIN local, publicação, reserva, histórico e cupons reais |
| Fila de espera / pacotes | Serviços e contratos SQL de 20/11 | Encaixes concorrentes, cancelamento e pacote sem inconsistência |
| Fidelidade | Consulta e tela de indicadores | Dados reais por identidade e salão; pontos/resgates apenas se implementados |
| Identidade visual | CSS global e máscaras | Inspecionar cada tela desktop/mobile, modais, ícones e campos |
| Auditoria / segurança | RLS documentada, scripts e migrations | Provas de isolamento, recuperação, logs seguros e permissões |
| Documentação | README mestre e guias técnicos | Manter todos os guias sincronizados com migrations e código |

### Checklist obrigatório antes de produção

- [ ] Rodar build, suíte completa, auditoria CSS, estrutura e migrations; registrar resultados e resolver achados relevantes.
- [ ] Testar proprietário, admin, recepção e profissional com memberships corretos, inclusive conta com mais de uma organização e troca de filial; garantir que o menu não desapareça indevidamente.
- [ ] Testar dois tenants independentes e clientes distintos, tentativa de acesso cruzado por IDs/RPCs, logout e troca de conta durante requisições.
- [ ] Testar cadastros com máscara, CEP, criação, edição, inativação/exclusão, modais, erros pt-BR e restauração autorizada.
- [ ] Validar ciclo Agenda → Comanda → Caixa → Comissão → Venda/estoque → estorno/reembolso com valores e vínculos conferidos.
- [ ] Validar orçamento com descontos, múltiplos profissionais, produtos, PDF e agendamento; fila de espera/encaixes e pacotes.
- [ ] Validar publicação de filial, pesquisa/GPS, perfil global, Google/Passkey, PIN local, reservas concorrentes, cupom, histórico, remarcação, favoritos, notificações e fidelidade.
- [ ] Inspecionar todas as telas em dispositivos reais, garantir CSS global, loading rápido, acessibilidade e ausência de dados fictícios.
- [ ] Validar backups, recuperação, migrações em QA, segredos, logs, limites e desempenho sob carga.
- [ ] Atualizar documentação técnica e registrar evidências de aceite. Não marcar concluído apenas porque existe um arquivo ou porque o build passou.

## Documentação técnica

- [Guia técnico e mapa do código](docs/GUIA-DO-CODIGO.md)
- [Arquitetura e integrações](docs/ARCHITECTURE.md)
- [SaaS multitenant](docs/SAAS-MULTITENANT.md)
- [Identidade visual e CSS global](docs/DESIGN_SYSTEM.md)
- [Tratamento de erros](docs/ERROR_HANDLING.md)
- [Agenda, Comanda e Caixa](docs/CAIXA_COMANDA_AGENDA.md)
- [Orçamentos](docs/ORCAMENTOS.md)
- [Comissões](docs/COMMISSIONS.md)
- [Histórico e reconciliação de migrations](docs/MIGRATIONS.md)
- [Inventário de migrations de 20/11](docs/migrations/remote-history-2026-11-20.json)
- [Identidade global da cliente](docs/CLIENTE-IDENTIDADE-MARCA.md)
- [Aplicativo da cliente](cliente/README.md)
- [Aplicativo profissional](professional/README.md)
- [Contratos SQL da cliente](docs/sql/customer-applied-migrations.test.mjs)
- [Contratos de pacotes, espera e fidelidade](docs/sql/appointment-offers-applied.test.mjs)

**Regra permanente:** documentação, segurança, desempenho, identidade visual e integridade dos dados fazem parte da implementação, não são melhorias opcionais para depois. Ao concluir uma alteração, registrar o que mudou, o que foi testado e o que continua pendente.
