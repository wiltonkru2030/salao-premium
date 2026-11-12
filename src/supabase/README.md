# Supabase — SALÃO PREMIUM

## Projeto conectado
- Projeto: `salao-premium`
- Região: `us-east-2`
- SDK: `@supabase/supabase-js@2.119.0` via ESM CDN
- Cliente: `src/supabase/client.js`
- Autenticação: `src/auth/auth.js`
- Serviço de dados com escopo de organização: `src/supabase/data-service.js`

A chave publicada no navegador é a **publishable key**. Nunca colocar uma `service_role` ou secret key no frontend.

## Tabelas criadas
`organizations`, `profiles`, `org_memberships`, `branches`, `customers`, `professionals`, `services`, `products`, `inventory_movements`, `appointments`, `appointment_blocks`, `sales`, `sale_items`, `cash_registers`, `cash_movements`, `expenses`, `commission_rules`, `commissions`, `app_settings`, `notifications`, `audit_logs`, `service_orders`, `service_order_items`.

Todas as 21 tabelas estão com RLS habilitado. As políticas isolam registros por `org_id`; a criação de uma conta gera automaticamente organização, perfil, associação de proprietário e unidade matriz através de trigger no banco. As permissões de gravação variam por função.

## Cadastro e primeiro acesso
1. Abra o site e escolha **Criar cadastro**.
2. Informe nome, nome do salão, e-mail e senha com pelo menos 8 caracteres.
3. Confirme o e-mail recebido.
4. Entre com e-mail e senha.

O Supabase Auth pode exigir que o endereço de retorno do site esteja permitido. No painel Supabase, em **Authentication → URL Configuration**, defina o Site URL do endereço publicado e adicione o endereço exato do site em Redirect URLs.

## API de dados
O módulo `data-service.js` expõe `listRecords`, `createRecord`, `updateRecord` e `deleteRecord`. Cada chamada obtém a organização da sessão autenticada e aplica o `org_id`; o banco reforça isso com RLS.

## Estado atual / próxima etapa
A autenticação e o cliente Supabase estão conectados ao shell do sistema. O serviço multi-tenant está pronto para uso pelos módulos. **As telas de Agenda, Clientes, Profissionais, Serviços, Produtos, Vendas e Financeiro ainda precisam trocar seus dados demonstrativos pelos métodos do serviço**; até essa migração por módulo, elas não devem ser tratadas como persistência de produção. A Agenda ainda opera com dados locais.

## Segurança
- Nenhuma chave privilegiada é enviada ao navegador.
- RLS ativado em todas as tabelas públicas.
- Associação de organização criada no servidor pelo trigger de Auth.
- A função de bootstrap fica no schema privado.
- A execução pública da função legada `public.rls_auto_enable()` foi revogada após alerta do advisor.


## App Profissional e Comandas
- App mobile-first/PWA: `professional/` (agenda mensal, serviços, comandas atribuídas, comissões e configurações).
- O profissional consulta somente os próprios agendamentos, comandas atribuídas e comissões; na comanda pode registrar apenas serviços realizados, sem alterar valores, produtos ou pagamentos.
- `appointments.booking_source` registra `customer`, `salon` ou `professional`.
- `service_orders` e `service_order_items` armazenam comandas e itens; o total é recalculado no banco quando itens mudam.
- `private.professional_login_identities` guarda somente HMAC do CPF, nunca CPF em texto. As Edge Functions resolvem o CPF no servidor; a função administrativa permite criar ou redefinir senha temporária apenas para owner/admin/manager.
- **Pendência de ativação:** as Edge Functions `professional-cpf-login` e `manage-professional-access` já estão publicadas. Falta cadastrar `CPF_LOGIN_PEPPER` em Edge Function Secrets no painel Supabase. Use um valor aleatório forte (mínimo 32 bytes), nunca reutilizado e nunca coloque no Git ou no navegador. Depois de salvar, não é necessário publicar as funções novamente.
- A senha temporária é exibida uma única vez ao administrador e deve ser entregue por canal seguro. A recuperação é exclusiva do administrador.
