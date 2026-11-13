# Identidade visual e CSS global

## Direção visual

- Fundo branco e superfícies claras.
- Texto preto/cinza, linhas discretas e dourado apenas como acento.
- Poppins para interface; Body Grotesque Fit para títulos quando disponível.
- Bordas suaves, sombras discretas e controles consistentes.
- Layout responsivo, sem modais ou formulários com aparência diferente entre módulos.

## Fonte global

`styles.css` importa a estrutura e, ao final, `src/styles/design-system.css`. O arquivo de design system define variáveis `--sp-*`, tipografia, botões, campos, cartões, listas, estados, modais, tabelas e breakpoints.

## Regras obrigatórias para novos módulos

1. Usar tokens `--sp-ink`, `--sp-muted`, `--sp-line`, `--sp-gold`, `--sp-paper` e dimensões globais.
2. Reutilizar classes globais `.btn`, `.field`, `.settings-card`, `.record-card`, `.empty-state` e `.sp-modal`.
3. Não criar paleta, tipografia, raio, sombra ou modal próprios sem justificativa documentada.
4. CSS de módulo deve conter somente layout ou comportamento realmente específico.
5. Toda tela deve ser revisada em desktop, tablet e celular, incluindo estados vazio, carregando, erro e conteúdo longo.

## Estado real da migração

O design system global existe e está importado, mas o CSS **ainda não está finalizado para o sistema inteiro**. Folhas legadas e regras específicas continuam carregadas antes dele; o arquivo global sobrescreve parte delas, mas isso não substitui uma revisão tela a tela. O trabalho pendente inclui inventariar seletores duplicados, migrar componentes antigos, remover regras conflitantes e fazer validação visual de todos os módulos.
