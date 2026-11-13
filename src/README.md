# Código-fonte do SALÃO PREMIUM

O projeto está em migração gradual para módulos de domínio pequenos, com contratos explícitos e isolamento multitenant.

## Entradas
- `app.js` e `index.html`: entrada do painel.
- `src/app.js`: inicialização, sessão e orquestração.
- `professional/app.js`: entrada do App Profissional/PWA.

## Organização
- `auth/`: autenticação e membership.
- `layout/`: shell e rotas.
- `components/`: componentes compartilhados.
- `pages/`: adaptadores e páginas legadas em migração.
- `modules/`: fronteiras de domínio, componentes isolados e documentação.
- `agenda/`: implementação especializada da Agenda.
- `types/`: contratos `.d.ts` de tenant e operações.
- `scripts/`: convenções para automação e manutenção.
- `utils/`: validações, máscaras, erros e utilitários.
- `styles/`: camadas CSS globais e estilos específicos.
- `supabase/`: cliente e contratos de persistência.

## Módulos prioritários
- Agenda: `agenda/` e `modules/agenda/`.
- Comanda: `pages/comanda.js` e `modules/comanda/`.
- Caixa: `pages/cash.js` e `modules/cash/`.
- Orçamentos: `pages/quotes.js` e `modules/quotes/`; componentes de apresentação separados.
- Comissões: `pages/commissions.js`.

## Padrões obrigatórios
1. Cada arquivo declara responsabilidade, dependências, parâmetros, retorno e efeitos colaterais relevantes.
2. Componentes não acessam Supabase; repositórios não montam HTML.
3. Operações financeiras e de agendamento críticas usam RPCs transacionais.
4. Toda consulta/gravação respeita organização e unidade; RLS é a autoridade de segurança.
5. Erros técnicos não são exibidos crus; mensagens ao usuário ficam em pt-BR.
6. Não resetar o banco nem apagar histórico financeiro para corrigir inconsistências.

Consulte `docs/` antes de alterar contratos de domínio.
