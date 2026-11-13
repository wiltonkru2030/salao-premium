# Auditoria inicial da recuperação Lovable — 13/11/2026

## Resultado

A recuperação foi preservada em patches históricos. A análise confirma que o primeiro commit não é um conjunto simples de arquivos isolados a copiar para a raiz do repositório atual.

### Estrutura encontrada no primeiro commit

| Prefixo | Arquivos |
|---|---:|
| `public/salao/src/` e demais `public/salao/` | 122 |
| `salao-premium/` | 51 |
| `src/routes/index.tsx` | 1 |
| **Total textual** | **174** |

O primeiro commit também contém 13 assets SVG binários, cujos bytes não foram expostos pela integração de leitura e permanecem pendentes.

### Achados importantes

1. **Duas árvores com responsabilidades diferentes:** `public/salao/` contém a aplicação estática JavaScript entregue ao navegador; `salao-premium/` contém documentação, scripts, migrations, Edge Functions e CI. O script `salao-premium/scripts/assemble-repo.sh` tenta juntar ambas.
2. **Redirecionamento da home:** `src/routes/index.tsx` troca a página placeholder por redirecionamento para `/salao/index.html`. Isso confirma que a aplicação foi montada para ser servida em `/salao/`, não como substituição direta da raiz.
3. **Risco no script de montagem:** `salao-premium/scripts/assemble-repo.sh` executa `rm -rf "$OUT"` com um destino fornecido pelo operador. Não deve ser executado com caminhos arbitrários; uma versão segura deve validar diretório temporário dedicado, impedir raiz/home/repositório e nunca apagar destino existente.
4. **Risco de migrations:** o patch de 64 alterações inclui migrations históricas, migrations arquivadas e versões corrigidas. Não aplicar o patch em lote nem copiar os arquivos para a pasta ativa sem comparar com `supabase_migrations.schema_migrations` e o estado real do banco.
5. **Escopo da recuperação:** os dois patches preservam o histórico textual; não equivalem a uma importação integral da aplicação, porque os 13 SVGs não estão presentes e a árvore ainda não foi reconciliada com o `main`.

## Decisão de integração

**Não mesclar as árvores `public/salao/` e `salao-premium/` diretamente na raiz atual.** Primeiro deve ser feito um mapeamento de equivalência entre os módulos JavaScript recuperados e os módulos existentes no repositório oficial, identificando arquivos novos, divergentes e duplicados. A branch de recuperação permanece isolada.

## Próximas verificações

- Comparar módulos de Agenda, Comanda, Caixa, Orçamentos, Profissionais, App Profissional e autenticação entre o snapshot recuperado e o código atual.
- Auditar migrations novas e alteradas individualmente, com leitura somente do banco.
- Recuperar os 13 SVGs por uma via de exportação que forneça os bytes originais.
- Executar build e testes unitários/integração em ambiente isolado antes de qualquer merge.

## Segurança

Nenhuma migration foi aplicada ao banco nesta auditoria. Nenhum registro do salão foi alterado ou apagado.
