# Código-fonte do SALÃO PREMIUM

O código está organizado em módulos, mas ainda existem arquivos concentradores em processo de refatoração. Consulte o [Guia técnico e mapa do código](../docs/GUIA-DO-CODIGO.md) para entender a responsabilidade de cada pasta, os pontos de concentração, o padrão de comentários e o tratamento de erros.

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
- `styles/`: estilos globais do painel.

## Manutenção
- Cada arquivo novo deve ter cabeçalho explicando sua responsabilidade.
- Funções exportadas devem documentar entradas, saídas e efeitos colaterais.
- Operações assíncronas devem tratar erros com `reportError` ou um tratamento local equivalente.
- Não ignorar erros de consultas auxiliares.
- Alterar uma funcionalidade por vez e executar build/testes antes de seguir.
