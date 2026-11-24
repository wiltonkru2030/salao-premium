# Módulo Equipe e permissões

Revisão: 24/11/2026. Contrato de manutenção; código localizado não significa homologação. Ver [README mestre](../../../README.md).

## Responsabilidade e arquivos

- Entrada: `src/pages/team.js`.
- Serviços e componentes: team.service.js: fetchTeamWorkspace/setReceptionAppAccess.
- Dados e contratos: org_memberships, profiles; set_professional_app_access.

## Segurança e permissões

RPC deve validar operador, organização e usuário-alvo; recepção calendar_all não ganha acesso financeiro. Não aceitar user_metadata como autorização.

## Regras e integrações

Exibir papel ativo e acesso concedido, revogar permissões e validar menu; se proprietário vê menu profissional, investigar membership/tenant sem desativar proteção.

## Padrão obrigatório

Separar apresentação, CSS, eventos, serviços, regras e consultas. Documentar arquivos e funções importantes com responsabilidade, entradas/saídas, erros, validações e efeitos. Usar CSS global, modais/listas visuais, máscaras aplicáveis, carregamento discreto e mensagens pt-BR. Preservar dados e tratar falhas de rede, sessão, concorrência e permissões.

## Testes e aceite

Scripts da raiz (via npm run): test:team-service test:tenant test:professional-access. Executar build e auditoria de estrutura/CSS. Testar em QA com perfis autorizados e negados, dois tenants, filiais distintas, dados controlados e interface desktop/mobile. Não executar escritas de teste em produção. Não marcar concluído sem evidências.
