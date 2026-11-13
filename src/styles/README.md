# CSS do painel

## Entradas
- `styles.css`: entrada de estilos do painel administrativo.
- `src/styles/design-system.css`: agregador global carregado por último.
- `professional/styles.css`: entrada visual do App Profissional; reutiliza os tokens do design system.

## Camadas globais
`design-system.css` importa em ordem: layout/tokens, navegação, componentes, dados, acessibilidade, ajustes transversais e modais.

## Camadas legadas em migração
- `components.css` agrega `components-base.css`, `components-team.css` e `components-charts.css`.
- `shell.css` agrega `shell-base.css` e `shell-collapse.css`.
- `agenda.css`, `quotes.css`, `drawer.css`, `lists.css`, `settings.css` e `responsive.css` mantêm composição específica até a migração para tokens compartilhados.

## Regra
Novos componentes devem usar os tokens e classes globais. Não criar um segundo sistema visual por módulo. CSS específico só deve conter a composição necessária daquela funcionalidade.
