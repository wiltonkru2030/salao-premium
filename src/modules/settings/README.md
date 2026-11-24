# Módulo Configurações

Revisão: 24/11/2026. Contrato de manutenção; código localizado não significa homologação. Ver [README mestre](../../../README.md).

## Responsabilidade e arquivos

- Entrada: `src/pages/settings.js`.
- Serviços e componentes: settings.controller.js: bindSettingsEvents; settings.view.js; integração com availability.
- Dados e contratos: organizations, branches, salon_public_profiles, branch_public_profiles; save_public_salon_profile.

## Segurança e permissões

Gestão condicionada ao papel autorizado, RLS e RPC. Publicação voluntária, sem exposição de tabelas operacionais.

## Regras e integrações

Dados do salão e unidade, vitrine pública, horários e identidade visual. Validar endereço, documento, logo, link próprio, edição de matriz e acesso por papel.

## Padrão obrigatório

Separar apresentação, CSS, eventos, serviços, regras e consultas. Documentar arquivos e funções importantes com responsabilidade, entradas/saídas, erros, validações e efeitos. Usar CSS global, modais/listas visuais, máscaras aplicáveis, carregamento discreto e mensagens pt-BR. Preservar dados e tratar falhas de rede, sessão, concorrência e permissões.

## Testes e aceite

Scripts da raiz (via npm run): test:tenant test:availability test:sql-customer-applied-migrations. Executar build e auditoria de estrutura/CSS. Testar em QA com perfis autorizados e negados, dois tenants, filiais distintas, dados controlados e interface desktop/mobile. Não executar escritas de teste em produção. Não marcar concluído sem evidências.

A Vitrine pública oferece preenchimento opcional pelo CEP da unidade. A consulta envia apenas os oito dígitos ao ViaCEP e sugere logradouro, bairro, cidade e UF. Os campos continuam editáveis, e a publicação só muda ao salvar o formulário. Consultas antigas são descartadas ao trocar o CEP ou o contexto da unidade.
