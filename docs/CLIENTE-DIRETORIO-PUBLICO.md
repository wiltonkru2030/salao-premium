# Diretório público de salões — implementação e pendências

## Implementado no repositório
- Busca da cliente por nome do salão/unidade, cidade/UF ou coordenadas.
- Cartões de resultado sem avaliações ou dados demonstrativos.
- Tela de detalhe por slug e filial, catálogo de serviços e profissionais.
- Serviços de consulta com validação de entrada, mensagens pt-BR e tratamento de RPC ausente.
- Formulário administrativo de perfil público em Configurações, com slug, nome, descrição, logo, capa, telefone, links, endereço público e coordenadas.
- A publicação exige seleção explícita do perfil da organização e da unidade.

## Contrato SQL
O rascunho está em docs/sql/customer-public-directory.draft.sql:
- salon_public_profiles e branch_public_profiles separam dados públicos das tabelas operacionais.
- RLS permite leitura e alteração de configuração somente a owner/admin.
- save_public_salon_profile grava perfil e filial em uma transação e valida links HTTPS e coordenadas.
- search_public_salons retorna somente salões e unidades publicados.
- get_public_salon_catalog retorna catálogo ativo de filial publicada.
- RPCs públicas expõem apenas os campos necessários; anon não recebe SELECT direto nas tabelas.

## Pendências
- O SQL não foi aplicado ao Supabase; por isso a busca mostra estado seguro de ativação até o backend existir.
- O formulário administrativo só aparece depois que as tabelas forem encontradas pelo schema.
- O catálogo precisa ser validado com dados reais após aplicar o SQL.
- A consulta de disponibilidade usa o rascunho separado docs/sql/customer-availability-slots.draft.sql.
- Não existe teste E2E completo de publicação → busca → catálogo → HOLD → confirmação.
