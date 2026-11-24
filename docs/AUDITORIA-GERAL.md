# Auditoria geral do Salão Premium

Este relatório registra a primeira rodada da auditoria da `main` em 24/11/2026, na base `970ee6cb7f23023fe398d98c56d675b00b159ffa`. A verificação cruzou README mestre, índice dos módulos, código, workflows, suíte automatizada e metadados do Supabase ativo. O repositório tinha 693 arquivos versionados e 2.236 commits alcançáveis a partir da base. A revisão individual de todos os arquivos, controles do GitHub e todos os objetos do banco ainda está em andamento.

## Segunda rodada no commit `a5e3dc71`

- Inventário automatizado de 699 arquivos, incluindo 30 READMEs, 193 arquivos SQL, 53 CSS e 12 arquivos binários. O histórico alcançável tem 2.238 commits. Os dois workflows do GitHub passaram neste commit. A API da branch retornou `protected=false` e nenhuma regra ativa para `main`.
- Código e banco ainda exigem conferência por requisito. A Área da Cliente tem uma view de PIN, mas o fluxo de entrada em `cliente/app.js` conecta Google e chave de acesso. O autocomplete compartilhado invalida a resposta apenas quando a próxima busca começa, deixando a resposta anterior elegível após apagar ou durante o debounce. Uma falha de consulta usa o mesmo estado da lista vazia.
- Consultas de catálogo em produção confirmaram 128 políticas, 60 funções em `public`, 77 em `private`, 143 eventos de trigger no catálogo e nenhum bucket. As três Edge Functions estão ativas. Nenhuma das sete funções com `SECURITY DEFINER` em `public` tem execução concedida a `anon` ou `authenticated`. As concessões a funções privadas precisam ser conferidas com os wrappers e as políticas. A consulta de branches do Supabase não retornou ambiente de QA.
- A comparação pelo conteúdo das instruções registradas no banco confirmou os 80 arquivos do snapshot. Das 17 versões posteriores ao snapshot, 11 coincidiram byte a byte com arquivos da pasta ativa. Uma coincidiu ao remover a primeira linha de comentário. As outras cinco foram comparadas com as instruções originais, e a cadeia candidata completa foi conferida por hash. A execução e a comparação dos objetos resultantes continuam pendentes. Quatro arquivos exclusivos da pasta ativa coincidem byte a byte com versões de outros nomes no snapshot. Nenhum SQL histórico foi reaplicado em produção.

## Cobertura por fluxo

| Área | Evidência de implementação | Pendências de implementação ou homologação |
| --- | --- | --- |
| Painel e App do Salão | Entrada Vite em `/`, sessão, navegação por papel, mudança de unidade, dashboard e configurações | Homologar persistência da sessão após atualizar, onboarding com matriz automática, acesso por perfil e comportamento em celular. A entrada web é compartilhada pelo painel e pelo salão. |
| Agenda, expediente e ofertas | Calendários dia/semana/mês, formulário com autocomplete, bloqueios, serviços de disponibilidade, lista de espera e ofertas | Corrigir testes dependentes de fuso e conferir expedi­ente, arraste, status, concorrência e oferta até o agendamento confirmado. |
| Comanda, Caixa e Comissões | Fluxos de itens, pagamento, caixa por filial, regras de comissão e SQL de centavos, estornos e snapshots | Homologar pagamento parcial/total, reembolso, reversão de comissão paga, conferência física, saída de comissão e concorrência. |
| Orçamentos | Módulo, testes de componentes e regras, função pública de resposta implantada | Validar PDF, WhatsApp, descontos e vínculo serviço–profissional até os horários após aceite. |
| Cadastros, catálogo e equipe | Clientes, profissionais, serviços, produtos, categorias, filiais e equipe com páginas/serviços | Conferir cada ação de cadastro/edição/inativação, catálogo por filial, consulta de CEP e autorização. |
| Vendas, estoque, despesas, financeiro e relatórios | Módulos e serviços, testes de serviços financeiros e documentação de integridade | Medir conciliação entre módulos, consistência da paginação, fluxos em concorrência e filtragem por unidade. |
| Cupons, pacotes e fidelidade | Código de cupons e fidelidade, RPCs e migrations para espera e pacotes | Validar configuração, compra/resgate e cancelamento em interface e banco de homologação. |
| Auditoria e recuperação | Tabelas de auditoria e lixeira com chamada de restauração no painel | Conferir cobertura por entidade, associação de autor, retenção, restauração e preservação financeira. |
| App Profissional | PWA, login CPF, funções de acesso, agenda mensal, comandas e comissões com testes locais | Homologar provisionamento, revogação, permissões por filial, recuperação pelo admin, origem e atualização de atendimentos. |
| Área da Cliente | Identidade global, Google e serviços Passkey, GPS, catálogo, reservas, favoritos, notificações, cupons, histórico e fidelidade no código | PIN local ainda sem ligação com o fluxo principal. Homologar configuração dos provedores, vínculo global, reserva concorrente, remarcação e acessibilidade. |
| Design system, logo e temas | Tokens e controles compartilhados, identidade oficial no repositório, máscara global e tema no app cliente | Unificar tokens, logo institucional, modais, temas claro/escuro/automático e transições nos três pontos de entrada. Verificar a disponibilidade da fonte licenciada. |
| Pesquisa, português e erros | Componente compartilhado em Agenda, Comanda, Comissões e itens do Profissional. Máscaras e mensagens reutilizáveis | Cobertura parcial. O autocomplete pode exibir resposta antiga após limpar o campo, e falha é exibida como lista vazia. Mapear formulários, unificar estados, foco, ARIA, buscas e mensagens. Revisar CNPJ alfanumérico. |

## Supabase, segurança e desempenho

- O catálogo consultado retornou 54 tabelas em `public`, todas com RLS habilitada, e 128 políticas nesse schema. A autorização efetiva por papel, organização e filial exige inspeção de cada política e testes em homologação.
- O Security Advisor retornou um aviso de proteção contra senhas vazadas desabilitada. O Performance Advisor retornou 44 chaves estrangeiras sem índice de cobertura e 43 índices marcados como sem uso. Esses indicadores orientam medição. Alterações de índice dependem da carga, das consultas e do período observado.
- Três Edge Functions estão ativas: `manage-professional-access`, `professional-cpf-login` e `respond-to-quote`. As duas últimas têm verificação de JWT no gateway desativada, compatível com entradas pré-login ou externas. Revisar as barreiras internas, limites de tentativa, escopo, consumo único de token e logs.
- A consulta ao catálogo de Storage não encontrou buckets. Fluxos de imagens e documentos precisam de verificação por mecanismo de armazenamento utilizado.
- Há 74 migrations em `supabase/migrations` e 97 registradas no remoto. São 64 versões em comum, 33 somente no remoto e 10 somente na pasta de trabalho. A cópia em `supabase/snapshot-remoto/migrations` tem 80 arquivos. Diferenças de identificador podem representar SQL equivalente. A reconciliação precisa comparar conteúdo e efeitos por objeto.
- Há 75 apontamentos na auditoria de estrutura e 31 funções exportadas sem JSDoc, incluindo pontos no cliente e no profissional. `cliente/app.js` tem 595 linhas. Os workflows usam Node 20 e 22, executam verificações locais e sobrepõem parte da suíte.
- O JS administrativo gerado mede aproximadamente 360 kB e 94 kB em gzip. Esse tamanho é uma linha de base de build. Tempo de login, latência das telas, volume de requisições, falhas e consultas lentas ainda precisam de medição.

Consulte [prioridades e critérios](PLANO-DE-EXECUCAO.md), [pendências](PENDENCIAS.md) e [evidências de teste](HOMOLOGACAO.md).

## Rastreabilidade dos requisitos do Transfer Dock

A tabela agrupa os requisitos por entrega e distingue inspeção de código de verificações em execução. O aceite de cada fluxo depende dos cenários indicados.

| Requisito | Evidência e estado | Aceite pendente |
| --- | --- | --- |
| Auditoria, documentação, GitHub e progresso | Inventário, dois workflows e quatro registros de acompanhamento versionados. Builds, suítes e auditorias executados conforme a [homologação](HOMOLOGACAO.md). | Concluir leitura individual dos arquivos, inspeção das configurações e cobertura por cenário. |
| Design system, logo, temas e acessibilidade | Tokens e estilos compartilhados em `src/styles`; tema local/remoto na cliente. App Profissional ainda monta a marca como texto em telas do fluxo principal. | Conferir tokens, logo oficial, temas e contraste nas três entradas e nos estados de erro e carregamento. |
| Organização, comentários e qualidade | Módulos e auditoria estrutural existentes. A linha de base registrou 75 apontamentos. | Conferir responsabilidades, documentação dos contratos e impacto das refatorações. |
| pt-BR, máscaras, validação e erros | Utilitários e testes em `src/utils`; existem integrações por formulário. | Mapear cobertura dos campos, CEP, CNPJ, colagem, edição, dados persistidos, falhas de rede e mensagens por módulo. |
| Pesquisa inteligente | Chamadas ao componente compartilhado em Agenda, detalhes da Comanda, Comissões e itens do Profissional. Defeito de invalidação e erro descrito acima. | Conferir os seletores por módulo, corrigir estados obsoletos, validar dados no servidor e testar teclado e toque. |
| Supabase, segurança e isolamento | Replay em QA; catálogo comparado e cenários de leitura executados. Gerente e recepção têm escopo organizacional para clientes, divergente do contrato por unidade. | Fechar diferenças de esquema e configuração; definir dados de atribuição por unidade, rever políticas e RPCs e testar leitura/escrita por papel. |
| Administração, Agenda, cadastro e recuperação | Pontos de entrada e serviços encontrados em `src/pages`, `src/agenda` e `src/modules`. | Verificar ações e formulários individualmente, incluindo inativação, recuperação e filtragem por unidade. |
| Orçamentos, operação e finanças | Serviços e validações estáticas de SQL encontrados. Links públicos passaram a seguir o ambiente configurado. | Testar aceite e agendamento, arredondamento, pagamentos, reembolso, comissão, estoque, concorrência e integridade entre módulos. |
| App Profissional | PWA, entrada por CPF, serviços de Agenda/Comanda/Comissões. QA confirmou rejeição de entrada inválida e visibilidade de uma unidade para a fixture profissional. | Login válido, provisionamento, revogação real, origem e restrições de atendimentos, perfil e responsividade. |
| Área da Cliente | Entradas de Google e chave de acesso; PIN local ausente do fluxo principal. RPC pública de pesquisa respondeu em QA. | Google/Passkey com provedores, identidade global, GPS, disponibilidades, reserva, remarcação, cancelamento, notificações, fidelidade e acessibilidade. |
| Desempenho | Build administrativo medido e advisors consultados. | Medir navegação, sessão, consultas, CPU e latência antes de alterar índices ou infraestrutura. |
| Homologação final | QA isolado ativo e critérios documentados. | Executar os cenários faltantes, registrar evidências e corrigir bloqueadores conforme a sequência do plano. |
