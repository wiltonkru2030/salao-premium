# Estornos e compensação de comissões

A candidata `docs/sql/commission-refund-reversals-v2.draft.sql` sucede o rascunho anterior; não executar ambos. Não aplicada ao Supabase remoto.

## Contrato
- Cancelamento de comanda parcialmente paga: estorno integral de todos os recebimentos confirmados, por autorização financeira e caixa aberto.
- Devolução de comanda quitada: mantém devolução de estoque opcional e movimentações de saída pelos métodos originais.
- Comissão pendente/aprovada: cancelamento. Comissão positiva já paga: débito negativo único vinculado ao registro original, sem apagar o repasse anterior.
- A vinculação respeita a organização. Bloqueio por profissional e lista fixa de lançamentos no repasse impedem incluir débitos novos sem somá-los.
- Política candidata: se o saldo líquido selecionado não for positivo, nenhum pagamento nem saída de caixa é criado. O crédito e o débito permanecem pendentes até haver saldo positivo. Não é cobrança automática ao profissional nem compensação parcial de saldo negativo.
- O painel passa a identificar débitos e mostrar a prévia líquida; o banco decide o valor definitivo. O app profissional e a confirmação por modal próprio ainda exigem revisão.

## Validação
14 condições estáticas conferidas na candidata v2. Teste unitário da prévia e teste estático registrados em test:all; execução da suíte/CI não confirmada. Nenhum dado financeiro criado ou alterado no banco.

Pendências de homologação: verificar restrições e triggers em banco descartável; testar corrida de repasse/estorno, isolamento de organizações, caixa de filial, débitos sucessivos e valores zero/negativos; validar vínculo/valor/identidade dos débitos em inserções privilegiadas; confirmar atomicidade do estorno e repasse; revisar divergência de saldo entre prévia e confirmação sob concorrência e histórico no aplicativo profissional. Atribuição do repasse à filial atual do profissional continua a regra existente, não uma nova política de rateio entre filiais. Não liberar antes de homologar a sequência integrada com snapshot e centavos.
