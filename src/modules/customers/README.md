# Módulo Clientes

Revisão: 24/11/2026. Contrato de manutenção; código localizado não significa homologação. Ver [README mestre](../../../README.md).

## Responsabilidade e arquivos

- Entrada: `src/pages/customers.js`.
- Serviços e componentes: customers.service.js: listCustomers/saveCustomer/setCustomerActive; camada de estado, views e controlador testados.
- Dados e contratos: customers; vínculos globais conforme docs/CLIENTE-IDENTIDADE-MARCA.md.

## Segurança e permissões

Consulta e alteração com org_id e filial aplicável; RLS autoriza. Não misturar cadastro operacional com identidade global nem unir clientes por telefone. Inativação preserva histórico.

## Regras e integrações

Cadastro e edição em modal, pesquisa, nome/WhatsApp, CPF/CNPJ quando aplicável, CEP/endereço, histórico e cadastro rápido na agenda/orçamento como requisito. Testar associação confirmada e dados privados.

## Padrão obrigatório

Separar apresentação, CSS, eventos, serviços, regras e consultas. Documentar arquivos e funções importantes com responsabilidade, entradas/saídas, erros, validações e efeitos. Usar CSS global, modais/listas visuais, máscaras aplicáveis, carregamento discreto e mensagens pt-BR. Preservar dados e tratar falhas de rede, sessão, concorrência e permissões.

## Testes e aceite

Scripts da raiz (via npm run): test:customers-service test:utils test:customer-rls. Executar build e auditoria de estrutura/CSS. Testar em QA com perfis autorizados e negados, dois tenants, filiais distintas, dados controlados e interface desktop/mobile. Não executar escritas de teste em produção. Não marcar concluído sem evidências.
