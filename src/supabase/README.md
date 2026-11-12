# Supabase — SALÃO PREMIUM

Este documento descreve a integração observada no código do repositório. Ele não substitui a verificação das políticas no painel Supabase nem declara que todos os módulos do produto estejam concluídos.

## Componentes

- `src/supabase/client.js`: inicializa o cliente Supabase utilizado pelo painel e pelo App Profissional.
- `src/supabase/data-service.js`: oferece operações genéricas de leitura e gravação com escopo de organização; várias páginas ainda fazem consultas diretamente pelo cliente.
- `src/auth/auth.js`: autenticação e contexto de sessão do painel administrativo.
- `professional/app.js`: autenticação e carregamento dos dados do App Profissional.
- `supabase/functions/`: funções server-side de acesso profissional e login por CPF.
- `supabase/migrations/`: histórico versionado de alterações de esquema e políticas.

## Módulos que atualmente consultam o Supabase no frontend

O código atual contém consultas Supabase nas áreas abaixo:

- Painel administrativo: Agenda, Clientes, Profissionais, Serviços, Produtos, Comandas, Comissões, Equipe e Recuperar.
- App Profissional: Agenda, Comandas, Serviços permitidos, Comissões e dados de perfil/configurações.

A presença de consultas no frontend não prova, por si só, que todo o fluxo esteja completo ou testado de ponta a ponta. Cada operação ainda depende do esquema existente, das políticas RLS e das permissões da sessão.

## Módulos ainda demonstrativos ou incompletos

Os seguintes módulos administrativos continuam usando adaptadores/listas de demonstração ou telas sem persistência completa no banco:

- Vendas
- Caixa
- Financeiro
- Relatórios
- Unidades
- Configurações administrativas

O Dashboard também contém indicadores e compromissos demonstrativos. Não utilizar esses números como dados reais do salão.

## Segurança e multiempresa

- Toda consulta administrativa deve limitar os registros à organização ativa e o banco deve reforçar o isolamento por políticas RLS.
- O App Profissional deve respeitar o escopo autorizado para cada conta; esconder um botão na interface não é controle de segurança.
- A autorização de operações sensíveis precisa existir no backend (RLS, RPC ou Edge Function), além das validações de interface.
- Nunca colocar `service_role`, chaves secretas, senhas temporárias ou segredos de Edge Functions no código entregue ao navegador.
- A autenticação por CPF deve ser resolvida no backend; o frontend não deve consultar uma tabela privada de identidades nem armazenar CPF como segredo.
- Antes de alterar uma política, RPC ou função, revisar a migração correspondente e testar com contas separadas de proprietário e profissional.

## Fluxo de manutenção

1. Conferir a tabela e os campos realmente usados pelo módulo.
2. Conferir todas as respostas Supabase, inclusive consultas auxiliares.
3. Confirmar que as políticas RLS protegem leitura e gravação por organização e função.
4. Validar dados no frontend e novamente no backend quando a regra for sensível.
5. Tratar falhas com mensagem segura e log contextual.
6. Testar com uma conta administrativa e uma conta profissional sem compartilhar sessão/permissões.
7. Executar `npm run build`, `npm run test:utils` e `npm run test:agenda`.

## Limites conhecidos

- Ainda existem módulos que consultam Supabase diretamente, sem passar pelo serviço genérico `data-service.js`; o padrão de acesso a dados precisa ser uniformizado gradualmente.
- Os testes automatizados atuais verificam sintaxe/build, utilitários de máscara e regras/componentes da Agenda. Eles não equivalem a testes E2E de autenticação, RLS, pagamentos ou interface em navegador.
- O estado real das políticas e dos dados deve ser confirmado no projeto Supabase conectado antes de qualquer publicação ou migração.


## Auditoria do projeto conectado

Consulte [docs/AUDITORIA-SUPABASE.md](../../docs/AUDITORIA-SUPABASE.md) antes de alterar políticas, funções ou migrações. O documento registra o estado observado do banco e a divergência atual entre o histórico remoto e os arquivos SQL do repositório.
