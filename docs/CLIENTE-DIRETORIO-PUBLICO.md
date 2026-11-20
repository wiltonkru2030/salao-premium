# Diretório público de salões — rascunho

A publicação é opt-in: nenhuma organização ou unidade aparece até o owner/admin ativar explicitamente a vitrine e publicar a filial.

O contrato SQL está em docs/sql/customer-public-directory.draft.sql. Ele cria tabelas separadas para dados públicos e mantém RLS administrativo nas tabelas de configuração. A busca e o catálogo usam RPCs que retornam somente campos permitidos; as tabelas operacionais não recebem SELECT para anon.

A busca aceita cidade/UF ou coordenadas e calcula distância sem exigir PostGIS. O catálogo retorna serviços ativos e profissionais ativos vinculados à filial. Não inclui e-mail privado, CPF/CNPJ, comissões, permissões ou dados de clientes.

O SQL ainda não foi aplicado. O painel ainda precisa de formulário para o owner/admin configurar slug, descrição, telefone, endereço público e publicação da organização/filiais.
