# Módulo Disponibilidade e expediente

Revisão: 24/11/2026. Contrato de manutenção; código localizado não significa homologação. Ver [README mestre](../../../README.md).

## Responsabilidade e arquivos

- Entrada: `src/pages/settings.js`.
- Serviços e componentes: availability.service.js: listAvailabilitySettings, addBranchBusinessHours, addProfessionalWorkingHours, addBranchClosure, addProfessionalTimeOff, removeAvailabilityEntry; availability-settings.view.js.
- Dados e contratos: branch_business_hours, professional_working_hours, branch_closures, professional_time_off, professionals.

## Segurança e permissões

RLS autoriza alterações por organização; unidade e profissional devem pertencer ao tenant. Validar intervalos e IDs no servidor.

## Regras e integrações

Expediente, pausas, folgas, almoço, curso e fechamento; integrar à disponibilidade do app cliente e conflitos da Agenda. Limites de consultas exigem conferência com volume real.

## Padrão obrigatório

Separar apresentação, CSS, eventos, serviços, regras e consultas. Documentar arquivos e funções importantes com responsabilidade, entradas/saídas, erros, validações e efeitos. Usar CSS global, modais/listas visuais, máscaras aplicáveis, carregamento discreto e mensagens pt-BR. Preservar dados e tratar falhas de rede, sessão, concorrência e permissões.

## Testes e aceite

Scripts da raiz (via npm run): test:availability test:agenda test:customer-services. Executar build e auditoria de estrutura/CSS. Testar em QA com perfis autorizados e negados, dois tenants, filiais distintas, dados controlados e interface desktop/mobile. Não executar escritas de teste em produção. Não marcar concluído sem evidências.
