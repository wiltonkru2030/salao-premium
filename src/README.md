# Organização do frontend SALÃO PREMIUM

O frontend usa JavaScript ES Modules. O arquivo `/app.js` é somente o ponto de entrada; não concentra a aplicação.

## Estrutura

- `src/app.js`: inicialização e eventos globais.
- `src/state.js`: estado compartilhado da interface.
- `src/data/index.js`: dados demonstrativos e configurações.
- `src/utils.js`: utilitários compartilhados.
- `src/layout/render.js`: estrutura do painel, navegação e roteamento.
- `src/components/drawer.js`: painéis de propriedades, detalhes e edição.
- `src/pages/dashboard.js`: dashboard.
- `src/pages/agenda.js`: agenda e visualizações dia/semana/mês.
- `src/pages/settings.js`: configurações.
- `src/pages/records.js`: componente reutilizável para listas de registros.
- `src/pages/customers.js`, `professionals.js`, `services.js`, `products.js`, `sales.js`, `cash.js`, `finance.js`, `commissions.js`, `reports.js`, `branches.js`, `team.js`: entradas independentes de cada módulo de negócio.
- `src/styles/`: estilos separados por base, estrutura, agenda, listas, configurações, painéis, efeitos e responsividade.

## Como funciona

O navegador carrega `index.html`, que importa o pequeno ponto de entrada `app.js` como módulo ES. O ponto de entrada importa `src/app.js`, que conecta os módulos. Cada página tem seu próprio arquivo e pode evoluir sem transformar o arquivo principal em um monólito.

`styles.css` é apenas o agregador dos arquivos CSS em `src/styles/`.

## Observação

Os módulos de páginas já estão separados. A persistência, autenticação, API e banco de dados continuam sendo etapas próprias de implementação; os dados atuais permanecem demonstrativos.
