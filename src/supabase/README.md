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
`organizations`, `profiles`, `org_memberships`, `branches`, `customers`, `professionals`, `services`, `products`, `inventory_movements`, `appointments`, `appointment_blocks`, `sales`, `sale_items`, `cash_registers`, `cash_movements`, `expenses`, `commission_rules`, `commissions`, `app_settings`, `notifications`, `audit_logs`.

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
