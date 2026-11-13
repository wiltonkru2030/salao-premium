# Arquitetura e integrações

## Camadas

- **Interface:** páginas em JavaScript, componentes reutilizáveis e estilos.
- **Estado e navegação:** `src/state.js`, renderização e inicialização em `src/app.js`.
- **Persistência:** Supabase Auth, Postgres, RLS e RPCs.
- **Operações críticas:** funções SQL transacionais para pagamentos, permissões e mudanças que afetam estoque ou caixa.

## Fluxo operacional esperado

1. O cadastro liga profissional aos serviços que pode executar.
2. A Agenda mantém cliente, serviço, profissional, horário e origem do agendamento.
3. A chegada pode abrir ou reutilizar uma Comanda.
4. Cada item da Comanda deve guardar serviço/produto, quantidade, preço, desconto e profissional responsável.
5. Cada recebimento confirmado gera pagamento e entrada correspondente no Caixa.
6. As Comissões usam regras vigentes por profissional e serviço/produto.
7. O pagamento da comissão gera saída no Caixa e histórico de pagamento.

## Regras de integridade

- Toda consulta e gravação deve ser limitada à organização e, quando aplicável, à unidade.
- O navegador não decide permissões: o banco e as funções de servidor validam papel e escopo.
- Operações financeiras devem ser atômicas: ou todos os registros relacionados são gravados, ou nenhum.
- Estornos e cancelamentos devem manter rastreabilidade.
- Não usar exclusão física para corrigir histórico financeiro.

## Como documentar código

Todo módulo deve começar com comentário contendo:
- objetivo e responsabilidade;
- dados que lê e grava;
- telas, tabelas, RPCs ou serviços dos quais depende;
- permissões e efeitos colaterais importantes.

Funções não triviais devem documentar parâmetros, retorno, validações, erros esperados e se a operação é transacional. Comentários devem explicar o motivo e as regras, não repetir literalmente o código.

## Situação conhecida

A arquitetura tem integrações existentes entre Agenda, Comanda e Caixa, mas a cobertura de testes ponta a ponta ainda é incompleta. A abertura de uma comanda para vários agendamentos agrupados ocorre por chamadas sequenciais de RPC no cliente; esse fluxo precisa ser consolidado em uma única operação transacional antes de ser considerado à prova de falhas.
