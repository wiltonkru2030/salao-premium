# Tratamento de erros

## Implementação compartilhada

`src/utils/errors.js` oferece:
- `userErrorMessage(error, fallback)`: converte códigos comuns de banco e autenticação em mensagens seguras em português.
- `reportError(error, {context, notify, fallback})`: cria um identificador de diagnóstico, registra contexto técnico no console e mostra mensagem ao usuário.
- `installGlobalErrorHandlers()`: captura rejeições de Promise e erros JavaScript globais.

O painel instala os manipuladores globais em `src/app.js`.

## Mensagens ao usuário

Erros conhecidos de validação, autenticação, permissão, conexão e integridade devem ser apresentados em português. Mensagens técnicas desconhecidas não devem ser exibidas literalmente: use uma mensagem segura e o código de diagnóstico.

## Diagnóstico

O console recebe o identificador `SP-...` e o contexto do módulo. Não registrar senhas, tokens, CPF, CNPJ, dados bancários ou outros dados pessoais desnecessários.

## Limitações atuais

A camada central existe e está em português, mas não é correto afirmar que todos os erros do sistema inteiro já estão traduzidos. Ainda há páginas com tratamento local, mensagens provenientes de RPCs, erros de Edge Functions e componentes antigos que precisam ser inventariados e testados. O critério de conclusão é revisar cada operação e garantir que nenhum erro técnico cru em inglês apareça para o usuário.
