# Auditoria geral do Salão Premium

Este relatório registra a primeira rodada da auditoria da `main` em 24/11/2026, na base `970ee6cb7f23023fe398d98c56d675b00b159ffa`. A verificação cruzou README mestre, índice dos módulos, código, workflows, suíte automatizada e metadados do Supabase ativo. O repositório tinha 693 arquivos versionados e 2.236 commits alcançáveis a partir da base. A revisão individual de todos os arquivos, controles do GitHub e todos os objetos do banco ainda está em andamento.

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
