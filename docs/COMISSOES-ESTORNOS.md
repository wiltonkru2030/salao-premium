# Estornos e compensação de comissões

## Problema encontrado no banco
A RPC atual de devolução total de comanda bloqueia a devolução quando alguma comissão já foi paga. Isso impede o estorno de ser concluído mesmo quando o salão precisa registrar a devolução e descontar o valor do profissional em um repasse futuro.

## Solução proposta
O rascunho docs/sql/commission-refund-reversals.draft.sql:
- mantém comissões não pagas canceladas quando a comanda é devolvida;
- cria uma linha negativa vinculada à comissão original quando ela já foi paga;
- usa reversal_of_commission_id e índice único para impedir débito duplicado;
- permite valores negativos nos itens do repasse;
- ao pagar qualquer conjunto de comissões do profissional, inclui automaticamente todos os débitos negativos pendentes;
- paga somente o saldo líquido positivo; se o saldo for zero ou negativo, nenhum repasse é criado e o débito permanece pendente;
- move a lógica privilegiada para private e mantém wrappers públicos SECURITY INVOKER.

## Limitações
- O rascunho trata devolução total de comanda quitada. Devolução parcial de pagamento ainda exige uma RPC própria e regra explícita de rateio.
- Faixas progressivas de comissão ainda não foram modeladas porque faltam limites, período de apuração e regra de reinício definidos pelo negócio.
- A migration não foi aplicada ao Supabase; não afirmar que o fluxo de estorno está ativo até aplicar, revisar e testar.

## Testes de aceite após aplicação
1. Comissão pendente de comanda devolvida é cancelada e não entra em repasse.
2. Comissão já paga gera exatamente um ajuste negativo, com vínculo à comissão original.
3. O próximo repasse do profissional inclui automaticamente todos os ajustes negativos pendentes.
4. O valor do repasse e da saída de caixa corresponde ao saldo líquido positivo.
5. Quando o saldo líquido é zero/negativo, o repasse não é criado e os débitos continuam pendentes.
6. A mesma comanda não pode gerar reversões duplicadas em chamadas repetidas.
7. Usuários sem papel owner/admin/manager/finance não conseguem devolver a comanda ou pagar comissão.
