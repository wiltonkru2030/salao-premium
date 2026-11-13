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

## Primeiro commit do Lovable

- `commit-401fc9e8-project-changes.patch`: patch com 174 arquivos textuais do commit `401fc9e8d09031ca544250a9a845bcbaa3ff4a93`.
- O diff original contém 187 arquivos: 174 textuais e 13 assets SVG binários.
- Os 13 SVGs não foram incorporados ao patch textual porque a integração de leitura não forneceu seus bytes; os caminhos originais são:
- `public/salao/brand/identidade-visual/icones/Banco de dados_20261112_105850_0038.svg`
- `public/salao/brand/identidade-visual/icones/Descontos_20261112_105849_0025.svg`
- `public/salao/brand/identidade-visual/icones/Documentos_20261112_105850_0039.svg`
- `public/salao/brand/identidade-visual/icones/Estoque_20261112_105849_0022.svg`
- `public/salao/brand/identidade-visual/icones/Horários_20261112_105848_0005.svg`
- `public/salao/brand/identidade-visual/icones/Jornada de trabalho_20261112_105850_0031.svg`
- `public/salao/brand/identidade-visual/icones/Promoções_20261112_105849_0026.svg`
- `public/salao/brand/identidade-visual/icones/Recebimentos_20261112_105848_0015.svg`
- `public/salao/brand/identidade-visual/icones/Recorrência_20261112_105848_0010.svg`
- `public/salao/brand/identidade-visual/icones/Segurança_20261112_105850_0037.svg`
- `public/salao/brand/identidade-visual/icones/Serviços_20261112_105849_0020.svg`
- `public/salao/brand/identidade-visual/icones/Vendas_20261112_105849_0019.svg`
- `public/salao/professional/icon.svg`

O primeiro commit contém uma árvore de aplicação em `public/salao/` e uma pasta `salao-premium/` separada. Ela foi preservada como patch, sem mesclar esses módulos ao código ativo, porque a duplicação de estrutura e o roteamento precisam ser comparados com a arquitetura oficial antes de integração.
