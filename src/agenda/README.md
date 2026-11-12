# Módulo Agenda — SALÃO PREMIUM

O módulo foi separado por responsabilidade e mantém compatibilidade com o aplicativo atual em JavaScript ES Modules (sem React/TypeScript configurado no repositório).

## Organização
- `pages/agenda-page.js`: composição da tela.
- `components/`: seletor de profissional, toolbar, calendários Dia/Semana/Mês, slots, cards, drawer, formulário, bloqueio e filtros.
- `hooks/`: fachada de estado/consultas para a camada de interface atual.
- `services/`: repositório temporário e motor local de disponibilidade.
- `utils/`: datas, duração e conflitos.
- `styles/agenda.css`: estilos específicos; identidade global continua centralizada nos estilos globais.
- `tests/`: verificações unitárias exportadas para execução em ambiente de teste.

## Contrato para integração futura
A interface deve continuar chamando `agendaRepository` (em `services/agenda.service.js`). Na integração, substituir as funções locais por chamadas HTTP e manter os mesmos formatos de retorno. O servidor deve validar novamente expediente, permissões, tenant/unidade, conflitos e concorrência antes de persistir.

## Limites atuais
- Fonte temporária: `src/data/index.js`; os dados são demonstrativos.
- Pré-visualizações não persistem e não devem ser usadas como agenda operacional.
- Ainda não há autenticação, autorização, API, banco, auditoria, notificações ou sincronização em tempo real.
- O motor local é uma pré-validação de UX, nunca uma autoridade de disponibilidade.
- O formulário e o bloqueio estão preparados visualmente, mas ainda não executam operações persistentes.
- Fotos, horários de expediente configuráveis, folgas, buffers, serviços compatíveis, salas/cadeiras, fusos por unidade e regras de cancelamento dependem dos cadastros e configurações reais.

## Testes
Os módulos `tests/agenda.test.js` e `tests/conflicts.test.js` exportam funções `run...Checks()`. Integrar ao runner de testes escolhido quando a configuração de build/teste for adicionada.
