# Plano e revisão visual do Salão Premium

A revisão abrange o painel administrativo, o App Profissional e a Área da Cliente. Mudanças se limitam à apresentação, à semântica e ao CSS.

| Bloco autorizado | Entrega e verificação |
| --- | --- |
| Base global | Reutilizar tokens para contraste, foco, desabilitado, controles de toque e leitura de valores. Comparar temas claro e escuro. |
| Estrutura responsiva | Conferir navegação, listas, modais e formulários em 360, 390, 768, 1024 e 1440 px. Checar conteúdo longo e teclado virtual. |
| Revisão por tela | Percorrer Dashboard, Agenda, Clientes, Profissionais, Serviços, Produtos e estoque, Categorias, Orçamentos, Cupons, Vendas, Comanda, Caixa, Despesas, Financeiro, Comissões, Relatórios, Unidades, Equipe e permissões, Recuperar e Configurações. Conferir também login, Agenda, Comandas e Comissões no Profissional e entrada, descoberta, agendamento, histórico e perfil na Cliente. |
| Limpeza e publicação | Remover seletores comprovadamente ociosos, executar a suíte, validar build das três entradas e publicar para conferência no Sites privado. |

Nesta revisão, os controles compartilhados receberam foco visível e estados acionado e desabilitado. Textos auxiliares do menu e das listas passaram a usar o token de contraste. O menu recolhido no celular saiu da ordem de foco. O toast usa uma região de anúncio e o carregamento de agendamentos da cliente foi identificado como estado de progresso. Foram removidos os seletores da pesquisa de Orçamentos substituída pelo autocomplete.

A suíte local, a auditoria CSS e o build foram executados. A rodada em navegador nas cinco larguras e o aceite individual das telas autenticadas continuam abertos. O executável Chromium disponível no ambiente apontava para um binário ausente.

A rodada de acabamento ajustou as superfícies de formulários, configurações e lista de espera para usar a paleta do tema. A Agenda ganhou uma faixa de profissionais, barra de ações e resumo mais compactos. Nos cadastros, as ações existentes de edição e inativação foram alinhadas ao botão secundário, com altura de toque e quebra de linha. Mantidas as condições de acesso e as ações de cada cadastro.
