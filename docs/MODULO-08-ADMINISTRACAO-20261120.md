# SALÃO PREMIUM — Módulo 08: Administração, Configurações e Permissões

## Escopo entregue nesta branch

- Configurações possui seleção **administrativa local** de unidade. Abrir a tela, consultar outra filial ou configurar sua vitrine/expediente **não modifica** o contexto operacional usado por Agenda, Comanda, Caixa e demais módulos.
- O modo "Todas as unidades" do cabeçalho é preservado. Na tela de Configurações, a matriz é apenas a unidade sugerida para edição; o usuário precisa escolhê-la explicitamente no seletor do cabeçalho para mudar o contexto operacional.
- O profissional vê somente sua unidade vinculada na tela de Configurações, como restrição adicional de apresentação. **Isso não substitui RLS** nem garante autorização por filial no banco.
- Equipe e Unidades descartam consultas antigas após mudança de organização, usuário, perfil ou rota. Dados de unidades deixam de usar cache global compartilhado por sessões.
- Ações de liberação do App Profissional aparecem somente para proprietário/administrador; a autorização final permanece na RPC `set_professional_app_access`.
- Falha na consulta de expediente não derruba toda a tela de Configurações; mostra aviso localizado. Ações de exclusão de horários não são exibidas para perfis sem permissão de edição.
- Folha visual específica `src/styles/design-administration.css` usa exclusivamente os tokens compartilhados (branco/preto/cinza/dourado sutil), responsividade e tipografia da marca.

## Arquivos centrais

- `src/pages/settings.js` — orquestra carregamento e evita resultados obsoletos.
- `src/modules/settings/settings.context.js` — decisão pura da unidade administrativa.
- `src/modules/settings/settings.controller.js` — eventos e gravações organizacionais.
- `src/modules/settings/settings.view.js` — apresentação e estados.
- `src/pages/team.js` — carregamento de usuários e permissão de acesso.
- `src/pages/branches.js` — cadastro de filiais com contexto isolado.
- `src/modules/availability/availability-settings.view.js` — controles de disponibilidade.
- `src/modules/settings/settings.context.test.js` — regressões de matriz/filial/profissional.

## Validação e limitações

O teste de contexto é executado por `npm run test:settings-context` e está incluído em `npm run test:all`. O workflow de PR também executa sintaxe JavaScript, build e demais suítes.

Este módulo é uma correção de interface e carregamento. **Não** cria migrations, não aplica SQL e não modifica dados de produção. A segurança real continua dependente de permissões RLS/RPC na base ativa, especialmente para isolamento entre filiais, publicação de perfil e administração de equipe.

Antes de liberar comercialmente, verificar em sessão real: proprietário e profissional, duas organizações, matriz + duas filiais; entrar em Configurações com "Todas as unidades" e confirmar que o cabeçalho não muda; alternar rapidamente tenant e filial; testar gravações permitidas/negadas e observar auditoria; validar as telas em celular.
