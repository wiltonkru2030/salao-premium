# Tratamento de erros e idioma pt-BR

## Camada central
`src/utils/errors.js` fornece:
- `userErrorMessage(error, fallback)`: traduz códigos comuns do Postgres, PostgREST, rede e autenticação.
- `reportError(error, {context, notify, fallback})`: gera código de diagnóstico e exibe texto seguro.
- `installGlobalErrorHandlers()`: captura rejeições de Promise e erros JavaScript globais.

A instalação ocorre uma vez em `src/app.js`.

## Segurança de mensagens e logs
- Erros técnicos desconhecidos em inglês nunca são exibidos literalmente; recebem mensagem genérica em português.
- Mensagens de domínio em português podem ser exibidas quando passam pela validação de segurança.
- SQL, stack traces, tokens, JWTs, senhas, CPF, CNPJ e dados bancários não devem aparecer na interface ou em logs.
- O console recebe metadados sanitizados (contexto, classe, código e mensagem segura), não o objeto bruto.
- Cada erro comunicado ao usuário recebe identificador `SP-...` para suporte.

## Cobertura de códigos
Inclui conflitos/duplicidade, integridade referencial, campos obrigatórios, restrições, conversão numérica, permissões, sessão expirada, registro inexistente, concorrência, deadlock, timeout, rede, credenciais e confirmação de e-mail.

## Testes automatizados
- `npm run test:errors`: mapeamentos pt-BR, fallback para inglês técnico e preservação de mensagens de domínio.
- `npm run test:utils`: máscaras e utilitários.
- `npm run test:quotes`: componentes de orçamento.
- `npm run test:agenda`: regressões da Agenda.

## Pendência de auditoria
A camada global e os módulos críticos foram fortalecidos. Ainda é necessário revisar todas as páginas antigas, integrações e mensagens escritas localmente. Não se deve declarar tradução integral enquanto uma busca de strings e um teste de navegação não confirmarem que nenhuma exceção técnica crua chega à interface.
