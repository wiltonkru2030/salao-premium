# Módulo Profissionais

Revisão: 24/11/2026. Contrato de manutenção; código localizado não significa homologação. Ver [README mestre](../../../README.md).

## Responsabilidade e arquivos

- Entrada: `src/pages/professionals.js`.
- Serviços e componentes: professionals.service.js: fetchProfessionalWorkspace, createProfessionalWithServices, updateProfessionalProfile, setProfessionalActive, setTeamProfessionalAppAccess, revokeProfessionalAppAccess; professional-access.service.js: requestProfessionalAccess; professionals.validation.js.
- Dados e contratos: professionals, services, professional_services, org_memberships, profiles; create_professional_with_services, set_professional_app_access, revoke_professional_app_access; Edge Function manage-professional-access.

## Segurança e permissões

RLS e RPC validam tenant, filial, papel e alvo. Criar profissional e serviços atomicamente; somente administração autorizada provisiona/redefine acesso; nunca logar CPF/senha.

## Regras e integrações

Cadastro PF/PJ/MEI, edição de dados, serviços habilitados, foto, comissão, expediente e bloqueios; testar cobertura de cada campo. Inativação e revogação não devem apagar histórico nem deixar acesso indevido.

## Padrão obrigatório

Separar apresentação, CSS, eventos, serviços, regras e consultas. Documentar arquivos e funções importantes com responsabilidade, entradas/saídas, erros, validações e efeitos. Usar CSS global, modais/listas visuais, máscaras aplicáveis, carregamento discreto e mensagens pt-BR. Preservar dados e tratar falhas de rede, sessão, concorrência e permissões.

## Testes e aceite

Scripts da raiz (via npm run): test:professionals-service test:sql-professional-creation test:professional-access test:tenant. Executar build e auditoria de estrutura/CSS. Testar em QA com perfis autorizados e negados, dois tenants, filiais distintas, dados controlados e interface desktop/mobile. Não executar escritas de teste em produção. Não marcar concluído sem evidências.
