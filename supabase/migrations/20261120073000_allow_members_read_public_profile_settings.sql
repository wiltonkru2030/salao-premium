-- SALÃO PREMIUM — leitura interna de configurações públicas da vitrine.
-- Owner/admin continuam sendo os únicos perfis que podem gravar a publicação.
-- Membros ativos podem carregar a tela de Configurações em modo somente leitura;
-- anon permanece sem grants e sem policy para consultar as tabelas diretamente.

begin;

drop policy if exists salon_public_profiles_member_read on public.salon_public_profiles;
create policy salon_public_profiles_member_read
  on public.salon_public_profiles for select to authenticated
  using ((select private.is_org_member(org_id)));

drop policy if exists branch_public_profiles_member_read on public.branch_public_profiles;
create policy branch_public_profiles_member_read
  on public.branch_public_profiles for select to authenticated
  using ((select private.is_org_member(org_id)));

commit;
