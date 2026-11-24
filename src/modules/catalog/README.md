# Módulo Catálogo — Serviços, Produtos e Categorias

Revisão: 24/11/2026. Contrato de manutenção; código localizado não significa homologação. Ver [README mestre](../../../README.md).

## Responsabilidade e arquivos

- Entrada: `src/pages/services.js, src/pages/products.js, src/pages/categories.js`.
- Serviços e componentes: services.service.js: listServices/saveService/setServiceActive; products.service.js: listProducts/saveProduct/setProductActive; categories.service.js: listCatalogCategories/saveCatalogCategory/setCatalogCategoryActive.
- Dados e contratos: services, products, catalog_categories; save_catalog_category e set_catalog_category_active.

## Segurança e permissões

Leitura limitada ao tenant e à unidade aplicável; serviços/produtos são gravados sob RLS de owner/admin e categorias por RPC. Preservar registros referenciados mediante inativação. Não alterar estoque de forma incompatível com os fluxos financeiros.

## Regras e integrações

Preço, duração, categoria, profissional habilitado, imagem/descrição, comissão de produto e catálogo por filial. Validar edição, inativação, máscaras e disponibilidade. Ajuste de estoque deve preservar trilha e regras do servidor.

## Padrão obrigatório

Separar apresentação, CSS, eventos, serviços, regras e consultas. Documentar arquivos e funções importantes com responsabilidade, entradas/saídas, erros, validações e efeitos. Usar CSS global, modais/listas visuais, máscaras aplicáveis, carregamento discreto e mensagens pt-BR. Preservar dados e tratar falhas de rede, sessão, concorrência e permissões.

## Testes e aceite

Scripts da raiz (via npm run): test:catalog-services test:catalog-products test:catalog-categories test:catalog-page-state test:sql-catalog-categories test:sql-branch-service-catalog. Executar build e auditoria de estrutura/CSS. Testar em QA com perfis autorizados e negados, dois tenants, filiais distintas, dados controlados e interface desktop/mobile. Não executar escritas de teste em produção. Não marcar concluído sem evidências.
