# Recuperação do histórico Lovable — 13/11/2026

Este diretório preserva alterações recebidas do projeto Lovable para auditoria e recuperação.

## Arquivo preservado

- `commit-053b2fd-migrations.patch`: patch histórico com as 64 alterações do commit Lovable `053b2fd159ccc8fe0fbeaedd7e641e8c28079d41`.
- O patch contém 33 migrations adicionadas, 25 migrations modificadas e 6 migrations renomeadas para arquivo histórico.
- Os caminhos originais foram mantidos no patch para rastreabilidade.

## Segurança

**Não aplique este patch com `supabase db push`, `psql` ou ferramenta de migrations.** É um artefato de auditoria, não um conjunto de migrations pendentes. O histórico inclui versões de migrations já registradas/aplicadas e alterações posteriores de conteúdo. Reaplicá-las pode causar divergência no histórico ou falha no banco.

As migrations novas do último commit Lovable foram mantidas separadamente na pasta ativa apenas como alterações de código; elas também não foram aplicadas ao banco nesta recuperação.

## Próxima etapa de auditoria

Comparar cada versão preservada com `supabase_migrations.schema_migrations` e com o estado atual do banco antes de decidir qualquer migração corretiva. Não remover nem reescrever dados de produção durante essa análise.
