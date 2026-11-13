# Identidade visual e CSS global

## Direção visual oficial

- Superfícies brancas e cinzas muito claros.
- Texto preto/grafite e cinza para informações secundárias.
- Dourado discreto apenas como acento.
- Poppins para interface; Body Grotesque Fit em títulos quando a fonte estiver disponível.
- Bordas suaves, sem sombras pesadas, botões e campos consistentes.
- Responsividade para desktop, tablet e celular.

## Fonte de verdade

`styles.css` importa os estilos estruturais, componentes e estilos específicos de módulos. `src/styles/design-system.css` é carregado por último para aplicar os tokens e os padrões globais.

Tokens principais:
- `--sp-ink`, `--sp-muted`, `--sp-soft`, `--sp-paper`
- `--sp-line`, `--sp-line-strong`, `--sp-gold`, `--sp-gold-soft`
- `--sp-radius`, `--sp-shadow`, `--sp-focus`, `--sp-control-height`

Componentes globais: `.btn`, `.field`, `.settings-card`, `.setting-row`, `.record-card`, `.record-list`, `.list-toolbar`, `.form-grid`, `.empty-state`, `.notice`, `.status`.

## Regras para novos módulos

1. Usar tokens e componentes globais antes de criar novos estilos.
2. CSS de módulo deve cuidar apenas de estrutura específica (calendário, gráficos, componentes especializados).
3. Não criar paleta, tipografia, raio, sombra ou modal diferentes sem justificativa.
4. Formulários, cartões, listas, mensagens vazias e estados devem usar a mesma escala visual.
5. Todo novo componente deve ter estados normal, hover, foco, desabilitado, carregando e erro.

## Estado atual

A camada global foi consolidada e ampliada para padronizar cartões, campos, botões, listas, formulários, estados, Caixa e Comanda; o import global permanece por último para prevalecer sobre estilos antigos. Os estilos de calendário continuam específicos porque representam uma grade funcional, não uma identidade visual separada.

**O que ainda não é correto afirmar:** que todas as telas foram inspecionadas visualmente em navegador real. A validação automatizada verifica sintaxe, imports, build e regressões; a conferência final de aparência em desktop e celular ainda requer abrir a aplicação e percorrer as telas reais.
