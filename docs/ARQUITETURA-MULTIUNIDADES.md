# Arquitetura multiunidades — SALÃO PREMIUM

> Especificação funcional e técnica aprovada para a evolução do SaaS. Este documento define o comportamento esperado para salão independente e redes com múltiplas unidades. Não representa declaração de que todos os fluxos já estejam implementados.

## 1. Princípio estrutural

A Empresa/Marca (tenant) e a Unidade Física (branch) são entidades distintas.

- Toda conta comercial cria uma organização e uma unidade principal em uma única operação transacional.
- Salão independente: uma organização + uma unidade principal. A interface oculta a troca de unidade quando só existe uma unidade disponível.
- Rede: uma organização + N unidades. A organização mantém identidade, assinatura, titularidade e cadastros globais; cada unidade mantém endereço, contatos, horários, operação e dados físicos.
- A existência de uma única unidade não cria um segundo modelo de dados. É apenas uma apresentação simplificada do mesmo modelo multiunidade.
- Ativar o modo multiunidades é uma capacidade comercial/funcional; não substitui RLS nem concede acesso.

## 2. Modelo de dados de destino

### 2.1 Empresa e unidade

**organizations** permanece como raiz do tenant: marca, documento principal, titular, assinatura/plano, identidade visual, fuso horário e configurações globais.

**branches** representa cada endereço operacional: nome de exibição, documento próprio opcional, endereço completo estruturado, bairro, cidade, UF, CEP, país, telefone/WhatsApp, e-mail, horário de funcionamento, fuso horário quando necessário, slug público, status e indicação de unidade principal.

Regras:
- Cada organização deve possuir exatamente uma unidade principal ativa, criada no onboarding.
- Toda filial pertence a exatamente uma organização.
- Slugs públicos são únicos no escopo definido (marca/unidade) e não podem permitir enumeração de dados privados.
- Inativar uma unidade bloqueia novos agendamentos e novas operações, mas preserva histórico, auditoria, fechamento e consultas autorizadas.
- Não apagar unidade com histórico financeiro ou operacional; usar inativação e trilha de auditoria.

### 2.2 Usuários administrativos e escopo de unidade

**org_memberships** continua representando a associação da identidade autenticada com a organização e o papel global.

Criar uma relação explícita de escopo por unidade (nome definitivo a decidir após revisão de convenções e migrations existentes), por exemplo **branch_memberships**:
- org_id, branch_id, user_id, role/scope, active, created_at, created_by.
- Chave única para (branch_id, user_id).
- FK composta ou validação transacional garantindo que branch_id pertença ao mesmo org_id.
- Owner e administrador geral podem ter acesso a todas as unidades por regra explícita; gerente e recepcionista só podem consultar e operar unidades atribuídas.
- Não confiar em branch_id enviado pelo navegador sem validar membership no banco.
- Acesso financeiro deve ser uma permissão distinta do simples acesso à agenda.

**Implementação em QA.** A migration `20261124121304` adiciona `public.branch_memberships` e `private.has_staff_branch_scope`. O papel e o status continuam em `org_memberships`. Proprietários e administradores podem inserir e excluir atribuições, e gerente e recepção só consultam as próprias. A exclusão do vínculo revoga o escopo. As chaves compostas impedem atribuições entre organizações. A função exige uma unidade ativa e atribuída para gerente e recepção e preserva o escopo central de proprietário e administrador.

Antes de ativar as restrições em Clientes, Agenda e Caixa, é necessário disponibilizar a gestão de atribuições, cadastrar o escopo dos usuários existentes e definir o tratamento dos registros centrais com `branch_id` nulo. A migration de preparação foi aplicada somente em QA.

### 2.3 Profissionais e escalas por unidade

O profissional tem identidade única dentro da marca e pode trabalhar em várias unidades.

Criar relação profissional-unidade (por exemplo **professional_branches**) com:
- org_id, branch_id, professional_id, active;
- dias da semana, horários/turnos e intervalos;
- serviços habilitados naquela unidade;
- antecedência e duração de deslocamento configurável;
- período de vigência da alocação, se necessário.

A associação profissional-serviço atual não deve ser interpretada como disponibilidade universal se o serviço só for prestado em algumas unidades. A disponibilidade precisa considerar simultaneamente unidade, profissional, serviço, escala e status.

### 2.4 Catálogo e estoque

- Serviços: cadastro global na marca quando compartilhados, com disponibilidade/preço/duração específicos por unidade quando necessário (relação serviço-unidade).
- Produtos: cadastro de catálogo global, com preço, disponibilidade e saldo controlados por unidade.
- Estoque: saldo por produto + unidade, com movimentações imutáveis e transferências entre unidades registradas como saída e entrada vinculadas.
- Não usar um único stock_quantity global como saldo de todas as filiais.
- Regras de comissão podem ser globais ou sobrescritas por unidade, com prioridade e snapshot no momento do primeiro recebimento.

### 2.5 Clientes e agendamentos

- Cliente é cadastro único dentro da organização/marca; não deve ser duplicado por unidade.
- O identificador do cliente deve ser resolvido por identidade autenticada e/ou contato normalizado, com regras de privacidade e prevenção de duplicidade.
- A unidade de origem/última visita pode ser registrada como preferência, sem transformar o cliente em propriedade daquela unidade.
- Todo agendamento deve ter uma unidade explícita (branch_id obrigatório para novos registros).
- Comanda, pagamento, venda, caixa, despesa, estoque e comissão precisam preservar a unidade de origem.
- Dados históricos com branch_id nulo exigem estratégia de backfill revisada; não atribuir unidade por suposição.
- O profissional não pode ter sobreposição de atendimentos entre filiais. A validação deve consultar todos os agendamentos ativos do profissional na organização, bloquear concorrência e aplicar o buffer de deslocamento configurado.

### 2.6 Financeiro

- Caixa e fechamento são independentes por unidade.
- Despesas, pagamentos, estornos, reembolsos, vendas e movimentações devem registrar org_id e branch_id coerentes com o caixa e a operação de origem.
- Comissões do profissional podem ser apresentadas consolidadas, mas cada item deve indicar a unidade do atendimento.
- Dashboard geral soma unidades sem misturar ou perder o detalhamento.
- Operações financeiras devem ser atômicas no banco, com locks, idempotência e auditoria.

## 3. Onboarding

Um RPC transacional de onboarding deve:
1. Validar identidade autenticada e dados obrigatórios.
2. Criar organization.
3. Criar a primeira branch como unidade principal.
4. Criar vínculo owner em org_memberships.
5. Criar configurações padrão e dados mínimos de operação.
6. Registrar auditoria.
7. Retornar IDs criados sem expor dados de outros tenants.

O formulário pergunta o formato:
- Salão único: organização + unidade principal; segue para horários, serviços e profissionais.
- Rede/filiais: organização + unidade principal; ao concluir a configuração inicial, abre gestão de unidades.

O usuário não deve conseguir criar organization/branch arbitrariamente por INSERT direto no cliente. O fluxo de onboarding precisa ser validado e protegido no banco.

## 4. Login e resolução de contexto

- Login único por e-mail/CPF conforme identidade suportada pelo provedor; não pedir código de filial.
- Depois da autenticação, resolver memberships ativas e permissões.
- Owner/admin geral: visão consolidada e seletor de unidade, com opções "Todas as unidades" e unidades individuais.
- Gerente/recepção: listar somente unidades explicitamente autorizadas; uma unidade abre automaticamente, múltiplas exigem seleção.
- Salão com uma única unidade: esconder seletor, sem remover o contexto de unidade do estado.
- Troca de unidade deve limpar filtros/dados anteriores e recarregar consultas. Nunca usar dados da unidade anterior durante o carregamento.
- Toda consulta/mutação deve ser limitada no servidor por org_id + branch_id e pelo papel/permissão do usuário.

## 5. App Profissional

- Uma identidade e um login para todas as unidades da marca.
- Uma unidade atribuída: abrir agenda dessa unidade sem etapa adicional.
- Múltiplas unidades: filtro de unidade/escala; cada cartão exibe nome e identidade visual da unidade.
- Agenda e conflitos são globais por profissional dentro da organização, incluindo buffer de deslocamento.
- Comissões exibem total consolidado e detalhamento por unidade.
- Profissional só consulta suas agendas, comandas e dados autorizados; não recebe permissões de gestão/caixa por estar associado a várias unidades.

## 6. App/portal do Cliente

- Cadastro único por marca; não criar uma conta nova para cada unidade.
- Marca com uma unidade: pular seleção de unidade.
- Marca com várias unidades: permitir seleção por cidade/bairro e ordenação por distância quando houver consentimento de localização.
- A busca pública deve retornar apenas dados públicos da unidade, nunca clientes, agenda privada ou dados financeiros.
- Após escolher unidade, filtrar serviços, profissionais, horários e preços pela disponibilidade daquela unidade.
- Exibir atalho de reagendamento para a última unidade visitada, permitindo alterar a unidade.
- Cada unidade possui link público próprio; link da marca abre seleção de unidades.
- Slugs e links públicos devem ser resolvidos por consulta segura e limitada, com rate limit/antiabuso quando necessário.

## 7. Regras de interface

- Se houver uma única unidade, esconder seletor e telas administrativas exclusivas de rede.
- Se houver duas ou mais unidades, mostrar seletor somente para perfis com acesso a mais de uma.
- "Todas as unidades" é filtro de relatórios e visões consolidadas; não é unidade válida para criar agendamento, movimentação, estoque ou caixa.
- Formulários de operações precisam exibir claramente a unidade de destino/origem.
- Unidade inativa não recebe novos agendamentos nem novas aberturas de caixa; histórico e fechamento pendente continuam acessíveis a perfis autorizados.

## 8. Estado encontrado na auditoria inicial — 19/11/2026

Já existem:
- organizations como tenant e branches como unidade física;
- org_memberships para papel global na organização;
- branch_id em appointments, customers, professionals, products, service_orders, cash_registers e cash_movements;
- RLS habilitado nas tabelas principais consultadas;
- estado de frontend com state.organization, state.membership e state.branch;
- telas iniciais de gestão de unidades e seleção de unidade nas configurações;
- caixa com seleção de unidade em implementação na branch de trabalho.

Lacunas confirmadas na leitura inicial:
- professionals possui branch_id simples, insuficiente para profissional em várias unidades com escalas independentes;
- professional_services não representa disponibilidade por unidade;
- services não possui branch_id nem relação explícita de disponibilidade por unidade;
- customers possui branch_id, embora o cadastro alvo seja único na marca; requer revisão cuidadosa e migração compatível;
- state.branch existe, mas a seleção de unidade ainda não está integrada como contexto obrigatório em todos os módulos;
- não foi identificada, na inspeção inicial, relação completa de permissões administrativas por unidade;
- agenda ainda precisa validar conflitos entre unidades e tempo de deslocamento;
- onboarding atual deve ser revisado: o signup observado cria usuário Auth, mas o fluxo completo de criação atômica de organization + unidade principal não foi confirmado;
- experiência de cliente com escolha de unidade, links públicos e última unidade visitada não está concluída.

Esta auditoria foi inicial e não substitui revisão completa de todas as policies, triggers, RPCs, constraints e dados históricos.

## 9. Plano de implementação recomendado

1. **Auditoria e compatibilidade:** mapear FKs, índices, triggers, policies, RPCs e dados existentes; classificar branch_id nulo e possíveis duplicidades antes de qualquer migração.
2. **Modelo de permissões:** escopo de usuário por unidade, RLS e helpers seguros; testar owner, admin, gerente, recepção, profissional e cliente em duas organizações.
3. **Onboarding transacional:** organização + unidade principal + owner, com testes de falha/rollback e idempotência.
4. **Contexto global de unidade:** seletor por papel, "Todas" somente para leitura consolidada e propagação do branch_id nos módulos.
5. **Profissionais e serviços:** relação N:N profissional-unidade, escalas e disponibilidade de serviços por unidade.
6. **Agenda global:** conflitos entre filiais e buffer de deslocamento com transação/lock no banco.
7. **Clientes e portal público:** identidade única por marca, seleção pública de unidade, links por unidade e última unidade visitada.
8. **Estoque e financeiro:** saldo e transferências por unidade, caixas, despesas, estornos, comissões e relatórios consolidados.
9. **Aplicativos:** experiência do profissional e do cliente com as mesmas regras de autorização.
10. **QA e liberação:** testes de isolamento cross-tenant/cross-branch, concorrência, auditoria, backup/restore e E2E antes de aplicar migrations em produção.

## 10. Regras de execução e segurança

- Não aplicar migrations no banco de produção sem autorização explícita.
- Não remover nem enfraquecer RLS para fazer a interface funcionar.
- SECURITY DEFINER somente quando indispensável, com auth.uid(), validação de tenant/unidade, search_path seguro, grants restritos e revisão de advisors.
- Novas tabelas em public precisam de decisão explícita de exposição/grants à Data API e RLS; grants e RLS são camadas diferentes.
- Toda migration deve preservar compatibilidade, incluir rollback/estratégia de backfill quando possível e ser testada em QA isolado.
- Nenhum recurso pode ser marcado como concluído apenas porque a tela foi criada: precisa de testes de banco, permissões, falhas, concorrência e fluxo completo.
