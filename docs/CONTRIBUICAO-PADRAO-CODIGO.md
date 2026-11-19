# Padrão obrigatório de documentação e tratamento de erros

Este padrão se aplica a todo código novo ou alterado no SALÃO PREMIUM. Comentários devem explicar intenção, regra de negócio, limites e efeitos colaterais — não apenas repetir o nome da função.

## 1. Cabeçalho de cada módulo

Todo arquivo JavaScript deve começar com um bloco JSDoc contendo:
- nome do módulo/domínio;
- responsabilidade principal;
- dependências ou integrações relevantes;
- regras de segurança/tenant importantes, quando aplicável.

Exemplo:

```js
/**
 * SALÃO PREMIUM — operações de Caixa.
 * Responsabilidade: validar os dados de entrada e delegar operações financeiras
 * às RPCs transacionais do Supabase.
 * Segurança: a autorização final e o vínculo com a organização são validados no banco.
 */
```

## 2. Documentação de funções exportadas

Toda função exportada deve ter JSDoc imediatamente antes da declaração, descrevendo:
- o que faz e quando deve ser usada;
- parâmetros e formatos esperados;
- retorno;
- erros que pode propagar;
- efeitos colaterais ou restrições de permissão, quando existirem.

Exemplo:

```js
/**
 * Registra um pagamento parcial de uma comanda.
 * @param {{supabase: object, orderId: string, amount: number, paymentMethod: string}} input Dados validados do pagamento.
 * @returns {Promise<object>} Resultado confirmado pela RPC transacional.
 * @throws {Error} Quando os dados são inválidos ou a RPC recusa a operação.
 */
export async function registerComandaPayment(input) {
  // ...
}
```

Funções internas também devem ser documentadas quando implementarem regras de negócio, cálculos financeiros, autorização, sincronização ou manipulação de dados. Funções triviais de apresentação podem usar comentários mais curtos.

## 3. Tratamento de erros

- Toda chamada assíncrona de I/O deve tratar a falha no ponto em que a interface pode recuperar, ou propagar o erro explicitamente para um limite que o trate.
- Não ignorar `error` retornado pelo Supabase.
- Não deixar botões permanentemente desabilitados: usar `try/catch/finally`.
- Exibir mensagens em português, sem SQL, tokens, stack traces ou dados pessoais.
- Registrar contexto funcional com `reportError`, sem registrar senhas, tokens, documentos ou payloads pessoais.
- Diferenciar validação, permissão, sessão expirada, conflito, conexão e indisponibilidade temporária.
- Não transformar erro em sucesso nem continuar fluxo financeiro após falha.
- Operações financeiras e de estoque devem permanecer transacionais no banco; tratamento de interface não substitui validação/RLS/RPC.

## 4. Como validar

- `npm run audit:structure`: inventário de cabeçalhos, JSDoc exportado e complexidade estrutural.
- `npm run test:errors`: testes de tradução segura de erros.
- `npm run test:all`: suíte unitária e auditoria estrutural.
- `npm run test:integration:backend`: testes reais de integração; executar somente com credenciais e organizações descartáveis de QA, nunca com dados de clientes.

## 5. Limite da auditoria automática

A auditoria estática identifica ausência provável de JSDoc em declarações exportadas, mas não entende a qualidade semântica do comentário, não detecta todos os callbacks internos e não prova que cada caminho de erro foi testado. Os apontamentos devem ser revisados por pessoa antes de considerar o padrão cumprido.
