# Integridade financeira — recebimentos e reversões

## Aplicado no Supabase
Migration 20261120211409_enforce_exact_centavo_service_order_payment: rejeita valores não finitos, não positivos ou fracionários de centavo; exige método válido; autorização nula é negada; valor não excede saldo e quitação é exata. Mantidos locks, caixa, venda, estoque e comissão atuais. Verificado no catálogo PostgreSQL: rotina privada, execução anônima negada, execução autenticada preservada e novos predicados presentes. Auditoria anterior: zero comandas fechadas com saldo divergente, pagamentos excedentes, parciais no limite e pagamentos inválidos. Nenhum recebimento real ou simulado foi realizado. Advisor de segurança permanece com um aviso de senhas vazadas.

## Em homologação
commission-refund-reversals-v2.draft.sql: guardas de correspondência do débito integral ao crédito original pago e de valor/profissional do item de repasse; autorização nula negada; seleção manual só admite créditos positivos. Débitos pendentes são incluídos automaticamente quando houver saldo líquido positivo. Política provisória: sem repasse quando líquido <= 0; estorno de comissão integral, sem parcelamento do débito. 20/20 padrões positivos conferidos no texto (não é execução Node nem SQL). Os fluxos de estorno e snapshot acumulado continuam dependentes de QA isolado, ordem de locks, compatibilidade de pagamentos antigos e conciliação das migrations. Idempotência de pagamento por chave de solicitação e testes concorrentes ainda pendentes. Não alterar valores históricos nem aplicar rascunhos financeiros sem homologação.

Manifesto remoto atualizado para 91 versões. Nenhum deploy ou merge nesta etapa.
