# Guia técnico e mapa do código

Este documento descreve onde cada responsabilidade mora e como manter o sistema sem quebrar os vínculos financeiros.

## Entradas da aplicação

- `index.html`: documento do painel.
- `app.js`: entrada mínima que carrega `src/app.js`.
- `src/app.js`: inicializa máscaras e captura global de erros, autenticação, navegação e eventos do painel.
- `professional/app.js`: entrada do App Profissional/PWA.

## Mapa de pastas

| Caminho | Responsabilidade |
|---|---|
| `src/auth/` | Sessão, login e escopo de acesso |
| `src/layout/` | Menu, shell, navegação e renderização |
| `src/components/` | Drawers, autocomplete e componentes reutilizáveis |
| `src/pages/` | Páginas administrativas por domínio |
| `src/agenda/` | Componentes, calendário, regras e testes da Agenda |
| `src/supabase/` | Cliente Supabase |
| `src/utils/` | Máscaras, validações e tratamento de erros |
| `src/styles/` | CSS base, componentes e design system |
| `supabase/migrations/` | Histórico SQL incremental |
| `supabase/functions/` | Edge Functions |

## Módulos de negócio principais

- `src/pages/agenda.js`: adaptador de entrada da página Agenda.
- `src/agenda/pages/agenda-page.js`: consulta e apresenta calendário, profissionais e bloqueios.
- `src/pages/comanda.js`: lista/detalha Comandas, itens, pagamentos e cancelamentos; usa RPCs para operações financeiras.
- `src/pages/cash.js`: abertura/fechamento do Caixa, resumo e histórico de entradas/saídas.
- `src/pages/commissions.js`: regras por profissional/serviço, lançamentos e pagamentos.
- `src/pages/professionals.js`: cadastro de profissionais, dados fiscais e serviços permitidos.
- `src/pages/quotes.js`: orçamentos, aprovação e agendamento agrupado.

Arquivos como `sales.js`, `finance.js`, `reports.js` e `branches.js` devem ser conferidos antes de assumir que possuem todos os fluxos de produção; algumas áreas ainda são adaptadores ou páginas demonstrativas.

## Operações de banco mais importantes

| RPC/função | Objetivo |
|---|---|
| `register_service_order_payment` | Receber pagamento total/parcial, registrar entrada no Caixa, gerar comissões e concluir venda/estoque na quitação |
| `private.accrue_partial_service_order_commissions` | Calcular comissão proporcional por recebimento parcial |
| `pay_professional_commissions` | Pagar lançamentos pendentes e registrar saída no Caixa |
| `open_cash_register` | Abrir caixa com validação de organização e papel |
| `close_cash_register` | Bloquear caixa, calcular saldo esperado e fechar |
| `start_appointment_group_service_order` | Abrir todos os serviços agrupados em uma Comanda na mesma transação |
| `cancel_service_order` | Cancelar Comanda; estornar pagamentos parciais e atualizar agendamentos/grupo |

## Padrão obrigatório para novos arquivos

Cabeçalho de módulo:
1. O que é e qual problema resolve.
2. O que consulta e o que grava.
3. Quais módulos, tabelas e RPCs utiliza.
4. Quais papéis podem executar ações.
5. Efeitos financeiros, de estoque ou agenda.

Funções de domínio devem documentar parâmetros, retorno, validações, erros esperados e se o banco executa a operação atomicamente.

## Padrão de erros

- Usar `reportError(error,{context:"Módulo > ação"})` para erros inesperados.
- Usar mensagens de validação em português para erros esperados.
- Nunca exibir stack trace, SQL, nomes internos de políticas ou tokens.
- Não registrar senhas, tokens ou documentos pessoais.
- Corrigir a origem do erro; não esconder erros de consulta auxiliar.

## Padrão visual

- Usar `src/styles/design-system.css` como fonte de tokens e componentes.
- O arquivo é importado por último em `styles.css`.
- CSS específico de módulo deve tratar apenas layout/visualização especializada.
- Não duplicar botões, campos, modais, cores ou escalas tipográficas.

## Segurança e banco

- Não confiar em `user_metadata` para autorização.
- Toda tabela exposta precisa de RLS apropriada.
- Funções `SECURITY DEFINER` devem validar usuário, organização e papel dentro do corpo.
- Não revogar funções existentes sem revisar chamadas e dependências.
- Não resetar banco remoto nem reaplicar migrations já registradas.
- Cada migration aplicada no Supabase deve ter arquivo com o mesmo version/name em `supabase/migrations/`.

## Verificação antes de concluir

1. Conferir sintaxe de todos os arquivos JS.
2. Executar build e testes automatizados.
3. Conferir migrations e funções no banco.
4. Verificar permissões/RLS e advisors.
5. Testar fluxo real com conta e dados controlados.
6. Conferir desktop e celular no navegador.
7. Atualizar documentação e registrar limitações que ainda existirem.
