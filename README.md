# SALÃO PREMIUM

Sistema de gestão para salões de beleza, com painel administrativo e App Profissional.

## Padrões obrigatórios

1. **Identidade visual única:** os módulos administrativos usam os tokens e componentes de `src/styles/design-system.css`. Os CSS de cada módulo ficam restritos à composição específica da tela.
2. **Dados integrados:** clientes, profissionais, serviços, Agenda, Comandas, Caixa e Comissões compartilham identificadores e escopo de organização/unidade.
3. **Segurança no servidor:** permissões, cálculos financeiros, disponibilidade e operações críticas são validados pelo Supabase, RLS e RPCs.
4. **Histórico preservado:** pagamentos, estornos, comissões e auditoria não são apagados nem alterados silenciosamente.
5. **Mensagens em português:** erros técnicos não devem ser exibidos crus ao usuário; o diagnóstico fica no console com identificador.
6. **Código documentado:** cada módulo explica responsabilidade, dependências, dados lidos/gravados, permissões e efeitos financeiros.

## Estrutura

- `src/app.js`: inicialização do painel, rotas e orquestração de eventos.
- `src/pages/`: páginas administrativas por domínio.
- `src/agenda/`: componentes, regras e tela da Agenda.
- `src/styles/`: CSS base, componentes e design system.
- `src/utils/errors.js`: tradução segura e registro centralizado de erros.
- `professional/`: App Profissional.
- `supabase/migrations/`: histórico versionado de alterações incrementais do banco.
- `supabase/functions/`: funções de servidor.

## Documentação técnica

- [Guia técnico e mapa do código](docs/GUIA-DO-CODIGO.md)
- [Arquitetura e integrações](docs/ARCHITECTURE.md)
- [Identidade visual e CSS global](docs/DESIGN_SYSTEM.md)
- [Tratamento de erros](docs/ERROR_HANDLING.md)
- [Agenda, Comanda e Caixa](docs/CAIXA_COMANDA_AGENDA.md)
- [Regras de Comissões](docs/COMMISSIONS.md)

## Situação da implementação

- **Design system global:** tokens, tipografia, botões, campos, cartões, listas, estados, formulários e responsividade compartilhados estão centralizados e importados por último em `styles.css`.
- **Agenda:** consulta o Supabase; a validação de conflitos e de profissional/serviço também é aplicada no banco; abertura de atendimento agrupado é transacional.
- **Comanda:** itens e pagamentos persistidos no Supabase; pagamentos parciais geram entradas no Caixa; cancelamento com recebimentos parciais exige estorno integral e gera saídas rastreáveis.
- **Caixa:** abertura, fechamento, recebimentos, estornos e pagamentos de comissão são operações protegidas no banco.
- **Comissões:** cada recebimento gera comissão proporcional, com percentual registrado no lançamento.

A padronização do CSS e as regras de backend foram atualizadas, mas ainda é necessário validar visualmente cada tela em navegador real e executar fluxos ponta a ponta com uma conta de teste e dados controlados. Build verde não substitui teste operacional.

## Segurança e manutenção

- Não resetar o banco nem apagar dados para corrigir funcionalidades.
- Criar migrations aditivas e manter os arquivos versionados em `supabase/migrations/`.
- Não registrar senhas, tokens, CPF, CNPJ ou dados bancários nos logs.
- Não marcar fluxo financeiro como concluído sem verificar os vínculos de Caixa, Comanda, pagamento, comissão e estorno.
