# Código-fonte do SALÃO PREMIUM

O código está organizado em módulos, mas ainda existem arquivos concentradores em processo de refatoração. Consulte o [Guia técnico e mapa do código](../docs/GUIA-DO-CODIGO.md) e o [fluxo integrado de Agenda, Comanda e Caixa](../docs/CAIXA_COMANDA_AGENDA.md) para entender responsabilidades, RPCs, vínculos financeiros, permissões e limitações.

## Entradas
- `/app.js`: entrada mínima do painel administrativo.
- `/src/app.js`: inicialização e orquestração do painel.
- `/professional/app.js`: entrada da aplicação PWA do profissional.

## Diretórios
- `auth/`: autenticação e sessão.
- `layout/`: shell, menu e roteamento.
- `pages/`: módulos de negócio.
- `components/`: componentes compartilhados.
- `agenda/`: módulo Agenda.
- `supabase/`: cliente e camada de dados.
- `utils/`: máscaras, mensagens e utilitários.
- `styles/`: CSS base, componentes e design system global (importado por último em `styles.css`).

## Manutenção
- Cada arquivo novo deve ter cabeçalho explicando sua responsabilidade.
- Funções exportadas devem documentar entradas, saídas e efeitos colaterais.
- Operações assíncronas devem tratar erros com `reportError` ou um tratamento local equivalente.
- Não ignorar erros de consultas auxiliares.
- Alterar uma funcionalidade por vez e executar build/testes antes de seguir.


## Módulos integrados
- `Agenda`: `agenda-page.js` lê agendamentos/bloqueios; `src/app.js` executa ações e abre grupos por RPC transacional.
- `Comanda`: `pages/comanda.js` gerencia itens e recebimentos; regras de pagamento, comissão e cancelamento ficam no Supabase.
- `Caixa`: `pages/cash.js` opera abertura/fechamento por RPC e apresenta entradas/saídas.
- `Comissões`: `pages/commissions.js` configura percentuais por profissional/serviço e paga lançamentos vinculados aos recebimentos.

Consulte `docs/` antes de alterar qualquer fluxo financeiro ou de disponibilidade.
