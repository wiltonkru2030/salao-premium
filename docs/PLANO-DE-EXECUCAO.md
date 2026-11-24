# Plano de execução do Salão Premium

Este plano contém 13 etapas para o escopo inventariado na [primeira rodada](AUDITORIA-GERAL.md). Novos achados da revisão integral devem atualizar o plano e seus critérios.

| Etapa | Escopo | Dependências e aceite |
| --- | --- | --- |
| 1 | Inventário e linha de base | Identificar módulos, migrations, fluxos, testes e limites de verificação. Completar rastreio por arquivo, objetos do banco, logs e controles do GitHub. |
| 2 | Segurança, integridade e histórico | Estabilizar a suíte em diferentes fusos, reconciliar migrations, revisar RLS/RPCs e priorizar riscos de perda de dados, senha e acesso cruzado. |
| 3 | Design system, logo e tema | Usar tokens e logo oficial compartilhados, preferências claro/escuro/sistema, modais e estados acessíveis em todas as entradas. |
| 4 | Pesquisa global | Garantir busca por domínio, limites, seleção por ID, teclado/toque, descarte de respostas antigas e validação por unidade. |
| 5 | Máscaras, pt-BR e erros | Padronizar campos, CPF/CNPJ, CEP, dinheiro, datas, erros e validações em formulário e servidor. |
| 6 | Arquitetura, comentários e CI | Separar responsabilidades, reduzir apontamentos, documentar funções e aplicar validação reproduzível no GitHub. |
| 7 | Login, sessão e permissões | Homologar sessão persistente, recuperação, isolamento por papel, matriz e filial e provisionamento profissional. |
| 8 | Administração e cadastros | Homologar painel, clientes, profissionais, catálogo, estoque, filiais, equipe, configurações e recuperação. |
| 9 | Operação e finanças | Homologar Agenda, Comanda, Caixa, Comissão, Vendas, Financeiro, Orçamento e Relatórios, inclusive concorrência e estornos. |
| 10 | App Profissional | Homologar agenda mensal, origem dos atendimentos, histórico, comandas restritas, comissões, perfil e revogação. |
| 11 | Área da Cliente | Homologar GPS, vitrine, Google/Passkey, PIN local, cupons, reservas, remarcação, fidelidade e acessibilidade. |
| 12 | Desempenho | Medir login, navegação, tamanho de assets, latência e planos de consulta. Confirmar ganhos antes e depois. |
| 13 | Homologação final | Executar matriz por papel e filial, integração, RLS, financeiro, concorrência, interface e dispositivos. Registrar resultados e resolver bloqueadores. |

A Etapa 1 abrange verificações ainda abertas. As Etapas 3 a 5 reutilizam componentes globais antes das revisões por aplicativo. Testes de integração e mudanças sensíveis dependem de ambiente autorizado e evidência de backup quando aplicável.
