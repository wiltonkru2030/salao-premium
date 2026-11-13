# Identidade visual e CSS global

## Direção visual oficial
- Superfícies brancas e cinzas muito claros.
- Texto preto/grafite; cinza para informação secundária.
- Dourado discreto como acento, nunca como fundo dominante.
- Poppins na interface; Body Grotesque Fit em títulos somente quando a fonte estiver disponível.
- Bordas suaves, sombras discretas, foco visível e componentes consistentes.
- Layout responsivo para desktop, tablet e celular.

## Ponto único de entrada
`styles.css` carrega a estrutura do painel e, por último, `src/styles/design-system.css`.
O arquivo `design-system.css` é um agregador pequeno. A ordem das camadas é explícita:

| Arquivo | Responsabilidade |
|---|---|
| `design-layout.css` | tokens globais, reset e base visual |
| `design-navigation.css` | menu, sidebar, topbar e navegação |
| `design-components.css` | botões, campos, formulários, cartões e listas |
| `design-data.css` | comissões, equipe, histórico e tabelas |
| `design-accessibility.css` | foco, acessibilidade e adaptação responsiva |
| `design-overrides.css` | ajustes globais posteriores e composição transversal |
| `design-modals.css` | modais, drawers, formulários de diálogo e estados específicos |

O App Profissional compartilha os tokens do design system por `professional/styles.css`; a composição mobile permanece própria.

## Tokens
`--sp-ink`, `--sp-muted`, `--sp-soft`, `--sp-paper`, `--sp-line`, `--sp-line-strong`, `--sp-gold`, `--sp-gold-soft`, `--sp-radius`, `--sp-shadow`, `--sp-focus` e `--sp-control-height`.

## Regras
1. Preferir componentes globais antes de criar CSS novo.
2. CSS de módulo cuida somente de estrutura especializada, como a grade de calendário.
3. Não criar paleta, tipografia, raio, sombra ou modal diferentes sem justificativa.
4. Todo componente interativo deve prever hover, foco, desabilitado, carregando e erro.
5. Manter os imports do design system por último no painel administrativo.
6. Não duplicar regras globais em folhas de estilo específicas.

## Limite da validação
A divisão em camadas foi implementada e o build automatizado verifica os imports CSS via Vite. Isso não equivale a inspeção visual de todas as páginas em navegador real. A conferência visual desktop/mobile permanece obrigatória antes de declarar a identidade visual integralmente aprovada.
