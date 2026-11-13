# Tratamento de erros

## Camada compartilhada

`src/utils/errors.js` fornece:
- `userErrorMessage(error, fallback)`: traduz códigos comuns de banco e autenticação para mensagens seguras em português.
- `reportError(error, {context, notify, fallback})`: registra diagnóstico com código `SP-...` e apresenta mensagem segura.
- `installGlobalErrorHandlers()`: captura rejeições de Promise e erros JavaScript globais.

O painel instala os manipuladores em `src/app.js`.

## Regras de interface

- Mensagens de validação, permissões, pagamentos, estoque, agenda e autenticação devem ser escritas em português.
- Mensagens técnicas desconhecidas não são exibidas literalmente; o usuário recebe um texto seguro e um código de diagnóstico.
- Mensagens de RPCs dos fluxos críticos Agenda, Comanda e Caixa foram mantidas em português.
- Não registrar senha, token, CPF, CNPJ ou dado bancário em logs.

## Estado real

O tratamento central e os principais fluxos críticos estão preparados para exibir mensagens em português. Isso não prova que todo o sistema esteja 100% traduzido: páginas antigas e integrações externas ainda precisam de auditoria individual. O critério de conclusão é que nenhum erro técnico cru em inglês seja exibido ao usuário, sem esconder o contexto de diagnóstico da equipe.
