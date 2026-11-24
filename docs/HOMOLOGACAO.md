# Homologação do Salão Premium

Registro da linha de base de 24/11/2026 e dos testes que dão aceite aos fluxos.

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Aprovado. Três entradas HTML geradas pelo Vite. |
| `npm run test:all` | A primeira execução parou no teste de serviço da Agenda. A execução individual dos 63 comandos revelou 62 conclusões com código zero e uma falha dependente do fuso. |
| `TZ=UTC npm run test:agenda` | Aprovado, inclusive o fluxo Agenda–Comanda simulado. |
| `TZ=America/Sao_Paulo npm run test:agenda` | Falhou ao tentar usar o ID do agendamento do cenário. Os horários fixos em UTC são interpretados no expediente civil local. |
| `npm run audit:structure` | Executado com 75 apontamentos. O script termina com código zero nesse modo. |
| `npm run audit:css` | Aprovado. Três entradas e 53 arquivos. |
| `npm run audit:migrations` | Código 1 por divergência de versões. O resultado coincide com a comparação das versões consultadas diretamente no Supabase. |
| Integração ativa, RLS com contas de teste, testes em navegador, acessibilidade e concorrência | A executar em homologação autorizada. A conexão Supabase disponível nesta verificação aponta para produção. |

O aceite requer pelo menos dois tenants, matriz e filial, usuários dos papéis de gestão, recepção, profissional e cliente, cenários de troca de sessão e operações concorrentes. Testar também Agenda → Comanda → Caixa → Comissão, Orçamento → Agendamento, reversões, estoque, autorização e a jornada de reserva da cliente. Capturar os resultados de teclado, toque, mobile, temas e rede degradada.

## Reteste da Agenda

Após o ajuste da fixture para horários civis, `TZ=UTC npm run test:all` e `TZ=America/Sao_Paulo npm run test:all` passaram, incluindo a suíte da Agenda. A alteração afeta somente o teste.


## Verificação independente do commit `a5e3dc71`

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Código 0. Três entradas, JS administrativo de 359,67 kB e 93,82 kB em gzip. |
| `TZ=UTC npm run test:all` | Código 0. |
| `TZ=America/Sao_Paulo npm run test:all` | Código 0. |
| `npm run audit:structure` | Código 0 e 75 apontamentos. |
| `npm run audit:css` | Código 0. Três entradas e 53 arquivos. |
| `npm run audit:migrations` | Código 1. São 33 versões somente no remoto e 10 somente na pasta ativa. |
| GitHub Actions | App validation e Agenda tests aprovados no commit de referência. |

Os testes de integração criam e removem registros. A suíte existente exige credenciais e URL de QA, com bloqueio explícito para a URL de produção. A homologação combina uma reprodução local descartável do esquema e um Supabase hospedado isolado para OAuth, chaves de acesso e funções implantadas.

### Banco local

A cadeia candidata de 97 migrations foi conferida por hash. A inicialização da pilha local encontrou limite de requisições do registro de imagens e falta de espaço. Uma tentativa com apenas Postgres também registrou falta de espaço ao extrair a imagem. Nenhum replay ou teste autenticado foi concluído nesta rodada.


### Supabase de homologação

O projeto `salao-premium-qa` (`eaiutjqvyesboldcznyr`) foi criado em `us-east-2`. A cadeia de 97 migrations foi aplicada em um banco vazio. O Supabase gerou os identificadores de execução do QA. As três Edge Functions foram publicadas em QA e responderam a preflight com HTTP 200. O Vault de QA recebeu uma chave própria para o login profissional. Com a chave disponível, o endpoint de login rejeitou CPF e senha vazios com HTTP 400 e mensagem em pt-BR.

- As assinaturas de catálogo de 613 colunas, 392 constraints, 211 índices, 130 políticas e 62 triggers de `public` e `private` coincidiram com produção. Entre as funções, produção tem `public.rls_auto_enable()` e QA tem `private.get_professional_cpf_login_pepper()`. As demais funções comparadas coincidiram em definição e grants.
- Um teste SQL com dois proprietários e claims diferentes confirmou leitura apenas dos clientes do próprio salão. As fixtures foram revertidas na mesma transação. A RPC do diretório público respondeu HTTP 200 com lista vazia em QA, e a tabela de perfis públicos recusou leitura direta anônima.
- Os builds padrão e de QA passaram. A verificação do módulo compartilhado gerado confirmou o endpoint efetivo de cada build. Os links de resposta a orçamentos usam a mesma configuração dos três aplicativos.
- A suíte HTTP autenticada completa, as contas de teste dos demais papéis, OAuth, chaves de acesso, provisionamento profissional, concorrência e ensaios de navegador continuam pendentes. O replay hospedado complementa a tentativa local, que permanece bloqueada pela capacidade de disco.


### Matriz de leitura por papel e unidade

Executado em `salao-premium-qa` com [fixtures SQL transacionais](../tests/integration/rls-role-inventory.sql). O salão A tem matriz e filial. O salão B tem uma matriz. Cada linha foi consultada com o papel PostgreSQL `authenticated` e o identificador da conta correspondente.

| Conta | Organizações visíveis | Unidades visíveis | Clientes das fixtures |
| --- | ---: | ---: | --- |
| Proprietário A | 1 | 2 | Matriz e filial A |
| Administrador A | 1 | 2 | Matriz e filial A |
| Gerente A | 1 | 2 | Matriz e filial A |
| Recepção A | 1 | 2 | Matriz e filial A |
| Financeiro A | 1 | 2 | Nenhum |
| Profissional A vinculado à matriz | 1 | 1 | Nenhum sem atendimento vinculado |
| Proprietário B | 1 | 1 | Matriz B |
| Conta autenticada sem vínculo | 0 | 0 | Nenhum |

O escopo entre salões foi respeitado nos cenários executados. Gerente e recepção têm acesso às duas unidades pela associação à organização. O [contrato multiunidades](ARQUITETURA-MULTIUNIDADES.md) exige limitar esses papéis às unidades atribuídas. Testes de escrita, permissões financeiras, cliente com identidade global, sessão HTTP real e atendimento vinculado ao profissional continuam pendentes.

### Escrita de clientes e operações de Caixa

A mesma matriz executou 18 combinações de papel e unidade em QA. Em cada cenário, verificou a atualização de cliente, a leitura da despesa de teste e a abertura de Caixa com R$ 10,25 pela RPC usada pelo aplicativo.

| Conta | Atualizou cliente na matriz e na filial A | Leu despesa nas duas unidades A | Abriu Caixa nas duas unidades A |
| --- | --- | --- | --- |
| Proprietário A | Sim | Sim | Sim |
| Gerente A | Sim | Sim | Sim |
| Recepção A | Sim | Não | Sim |
| Financeiro A | Não | Sim | Sim |
| Profissional A | Não | Não | Não |
| Conta sem vínculo | Não | Não | Não |

Nenhuma das contas testadas atualizou clientes, leu despesas ou abriu Caixa no salão B. Em A, a atualização de clientes e a abertura de Caixa por gerente e recepção abrangeram as duas unidades, o que confirma o escopo organizacional registrado em SEG-02. A abertura foi revertida a cada cenário e os demais dados foram revertidos ao fim da sessão. A seção seguinte cobre o fechamento. Pagamentos, estornos, concorrência e permissões dos demais papéis ainda precisam de testes próprios.

### Resumo e fechamento de Caixa

Foram executados 18 cenários adicionais em QA com a mesma matriz SQL. Em oito cenários autorizados, proprietário, gerente, recepção e financeiro consultaram e fecharam o Caixa da matriz e da filial do salão A. Os dez cenários referentes ao outro salão, ao profissional ou à conta sem vínculo foram recusados.

A abertura de R$ 10,25, a entrada de R$ 42,37 em dinheiro e a saída de R$ 7,12 em dinheiro produziram saldo esperado de R$ 45,50. Os movimentos de R$ 60,00 em PIX e R$ 80,00 em cartão ficaram fora da conferência física. O fechamento contado de R$ 44,25 retornou diferença de −R$ 1,25. Cada tentativa de repetir o fechamento foi recusada. Os movimentos foram inseridos como fixtures para isolar a conferência de Caixa. A validação de pagamentos, estornos e concorrência depende de cenários próprios.

### Pagamento e devolução da Comanda

A [verificação transacional](../tests/integration/payment-refund-audit.sql) executou as RPCs públicas em QA com uma conta proprietária. Sem Caixa aberto, o recebimento foi recusado. A Comanda de R$ 100,03 aceitou R$ 40,01 em PIX e R$ 60,02 em dinheiro. Fração de centavo, um centavo acima do saldo e repetição após quitação foram recusados. A quitação gerou venda e baixou uma unidade de estoque.

A devolução integral marcou a venda como devolvida, cancelou a Comanda e repôs o estoque. O Caixa registrou entradas e saídas de R$ 100,03, e o saldo físico retornou a R$ 10,25. A segunda devolução foi recusada.

Em uma segunda fixture, duas sessões tentaram quitar a mesma Comanda. A primeira concluiu dentro da transação e reteve o bloqueio. A segunda atingiu o limite de espera configurado e abortou. As duas transações foram revertidas. A limpeza confirmou zero contas e organizações das fixtures. Este cenário confirma o bloqueio durante a disputa. O teste após confirmação foi executado em uma fixture separada, descrita abaixo.

#### Quitação concorrente com confirmação

Em QA, duas sessões autenticadas chamaram `register_service_order_payment` para quitar a mesma Comanda de R$ 100,03. A primeira manteve a transação aberta por cinco segundos após a RPC e então confirmou a quitação. A segunda iniciou durante essa janela, esperou pelo menos um segundo dentro da chamada e recebeu a mensagem “Esta comanda não aceita pagamentos.” após a confirmação da primeira.

A consulta após as duas chamadas encontrou a Comanda fechada, um pagamento confirmado de R$ 100,03, uma entrada no Caixa, uma venda paga e estoque reduzido de duas unidades para uma. Os registros das fixtures de concorrência foram removidos de QA. Este cenário cobre duas tentativas simultâneas de quitação integral da mesma Comanda.


### Atribuições de unidade

A migration de preparação da SEG-02 foi aplicada em QA. A matriz transacional confirmou atribuições distintas para gerência e recepção, ausência de escopo central nesses papéis, escopo central do proprietário, rejeição de autoatribuição e de filial de outro salão e revogação imediata. O papel anônimo ficou sem acesso de leitura à tabela e sem execução da função privada. A matriz anterior de Clientes e Caixa voltou a passar. A consulta posterior confirmou zero atribuições e organizações de teste.


### Verificação de escopo nos módulos

Após a migration `20261124121700` em QA, gerente (matriz) e recepção (filial) leram e editaram clientes e agendamentos apenas na unidade atribuída. As RPCs de abertura, resumo e fechamento de Caixa aplicaram o mesmo escopo. A matriz executou oito cenários de leitura, 18 combinações de escrita e abertura e 18 de resumo e fechamento. Seis combinações de resumo e fechamento permaneceram autorizadas. Proprietário e financeiro conservaram as operações de Caixa nas duas unidades do salão A, e os cenários do outro salão seguiram recusados. Os resultados anteriores documentam o comportamento antes da migration.

A migração passa a exigir atribuições para gerente e recepção. A conferência de QA cobre operações diretas e as RPCs de Caixa exercitadas. As RPCs de espera, pacotes, início de atendimento, pagamentos e demais operações integradas ainda precisam de revisão de escopo.
