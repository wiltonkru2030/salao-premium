# Regras de Comissões

## Regras comerciais

- O profissional pode ter percentual padrão.
- Uma regra específica por profissional + serviço substitui o percentual padrão.
- Exemplo: corte 50%, progressiva 40%, escova 40%.
- Produtos podem ter regra própria, conforme a configuração do salão.
- Sem profissional responsável, o item não gera comissão individual.
- O percentual aplicado deve ser salvo no lançamento para preservar o histórico quando a regra mudar.

## Exemplo

Corte de R$ 100,00 a 50% gera R$ 50,00. Progressiva de R$ 300,00 a 40% gera R$ 120,00. Total ilustrativo: R$ 170,00.

## Caixa

- Recebimentos de Comanda são entradas no Caixa.
- Pagamento ao profissional é uma saída no Caixa.
- A baixa da comissão deve vincular profissional, lançamento, forma de pagamento, usuário responsável e movimento de caixa.

## Estado técnico observado

A tabela `commission_rules` já suporta regras por profissional e serviço; a tela de Comissões ganhou formulário para cadastrar e excluir essas regras. O backend de recebimento de Comanda atualmente cria as comissões no fechamento integral da Comanda. Portanto, comissão proporcional a cada pagamento parcial ainda não está implementada e não deve ser anunciada como pronta. Essa mudança exige ledger por recebimento e tratamento de estornos sem duplicar ou alterar comissões já pagas.
