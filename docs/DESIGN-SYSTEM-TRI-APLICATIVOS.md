# Identidade visual compartilhada — SALÃO PREMIUM

## Contrato
- src/styles/design-tokens.css: fonte central de cores, tipografia, bordas, dimensões e foco para painel, cliente e profissional.
- src/styles/shared-controls.css: estilos compartilhados e escopados aos roots, formulários com fonte maior em telas estreitas, foco visível, redução de animações, estados desabilitados, seleção de horário, rolagem de diálogos.
- design-system.css continua organizando as camadas administrativas; cada aplicativo preserva a composição própria. Theme escuro da cliente tem aliases específicos.
- Poppins via import existente do Google Fonts; Body Grotesque Fit é fallback tipográfico declarado, sem confirmação do arquivo licenciado. Não incluída fonte sem autorização.
- Orçamento: cadastro rápido de cliente passa a dialog nativo com estrutura sp-modal, abertura, fechamento, backdrop e foco padrão.
- Máscaras: os três aplicativos instalam src/utils/input-masks.js; proteção de campos de credenciais, composição IME, cursor por dígitos, preservação de DDI no perfil da cliente. Não alteradas regras de autenticação. A máscara CNPJ existente é numérica; suporte alfanumérico, validação fiscal e revisão do parser monetário continuam pendentes.

## Verificação
21/21 verificações estáticas efetuadas após releitura dos arquivos. Testes de regressão das máscaras, perfil global e contrato CSS incluídos na suíte. A execução Node/CI não foi confirmada. Não houve inspeção visual em navegador, revisão de todos os SVGs originais ou auditoria de todos os modais e formulários existentes. CSS legado ainda contém valores fixos; migração completa dos controles para tokens e validação de contraste e responsividade por tela permanecem pendentes. Nenhum deploy, merge ou alteração no Supabase nesta etapa.

### Símbolo da plataforma

O componente `src/components/platform-mark.js` usa o símbolo WebP transparente da identidade oficial. O build inclui o arquivo uma vez, com caminho resolvido nas três entradas. O nome visível identifica a marca junto à imagem decorativa. As logos dos salões continuam vinculadas aos seus perfis.
