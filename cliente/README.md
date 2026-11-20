# Área da Cliente — SALÃO PREMIUM

Aplicativo independente servido em /cliente/, separado da autenticação administrativa e profissional.

## Estrutura modular
- services/: autenticação, API, perfil, GPS, catálogo, agendamento, cupons, favoritos, notificações, configurações e termos.
- ui/: componentes de navegação e entrada de PIN.
- styles/: tema, reset, layout, componentes, páginas e responsividade.
- app.js: composição da aplicação e ciclo de sessão.

## Implementado nesta etapa
- Autenticação Google e Passkey encapsulada em services/authService.js.
- API HTTP padronizada com timeout e erros em português.
- Validação de perfil global existente.
- Leitura de GPS sob ação explícita da cliente e cálculo de distância Haversine.
- Preferências locais não sensíveis e limpeza restrita de cache.
- Estrutura de navegação após autenticação.
- Contratos de serviços separados. Funcionalidades dependentes de tabelas/RPCs ainda não implantadas falham explicitamente e não simulam sucesso.

## Segurança
- Identidade global depende de auth.uid(); nunca confiar em identificador enviado pelo navegador.
- Google e Passkey são os métodos de autenticação principal.
- PIN de quatro dígitos não é autenticação autônoma. O componente de entrada não persiste PIN.
- Não associar clientes antigos automaticamente por telefone, nome ou data de nascimento.
- Não expor chave service_role em código do navegador.
- Dados operacionais continuam isolados por organização e filial.

## Não liberar em produção
O aplicativo ainda não tem catálogo público, agendamento transacional, histórico, cupons ou notificações integrados. O perfil global depende da migration e dos testes RLS. A autenticação depende da configuração Google/Passkey no Supabase.
