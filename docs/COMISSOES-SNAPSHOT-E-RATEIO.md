# Comissão congelada e rateio acumulado

Candidata: `docs/sql/commission-cumulative-snapshot.draft.sql`. Substitui a candidata de centavos isolada quando validada. Não aplicada ao banco remoto.

- Congela percentual e elegibilidade no primeiro recebimento. A mesma rotina calcula todas as parcelas, inclusive a final.
- Calcula a diferença entre comissão acumulada devida e lançamentos anteriores, evitando arredondamento repetido. Exemplo: três parcelas de R$ 0,01 com taxa de 50% totalizam R$ 0,02 de comissão, não R$ 0,03.
- Distribui a base integral entre itens por diferenças de totais arredondados e progride proporcionalmente ao recebido. Diferenças de centavos intermediárias são absorvidas na quitação.
- Comandas legadas parcialmente pagas sem snapshot exigem conciliação, não atribuição retroativa de taxa atual.
- Preserva venda, estoque, caixa e wrapper público. Bloqueia chamada direta do auxiliar de comissão.

Pendências obrigatórias: revisar proteção contra edição direta de snapshots e itens após recebimento, reconciliar migrations antigas, executar QA real com concorrência e múltiplos profissionais, verificar restrições de valores e reversões já pagas. O rascunho de estornos continua separado e não aplicado. Não liberar em produção.
