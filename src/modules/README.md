# Módulos de domínio

Este diretório é a fronteira de cada módulo de negócio. A implementação legada permanece acessível por adaptadores em `src/pages/` até que a migração de imports seja concluída.

## Estrutura obrigatória por módulo

```text
src/modules/<modulo>/
  index.js              # API pública do módulo
  pages/                # composição da página; sem SQL inline
  components/           # interface pequena e reutilizável
  services/             # regras de aplicação e coordenação de operações
  repositories/         # consultas Supabase sempre limitadas ao tenant
  types/                # contratos JSDoc/.d.ts do módulo
  scripts/              # tarefas internas, seeds e manutenção não carregadas no browser
  styles/               # somente CSS específico do módulo
  tests/                # testes unitários e de integração
  README.md             # regras, permissões, tabelas, RPCs e efeitos colaterais
```

## Regras de fronteira

- A página não executa SQL diretamente: chama um serviço/repositório. O seletor de organização só entrega contexto depois de validar o membership ativo.
- Componentes recebem dados e callbacks; não conhecem o cliente Supabase.
- Repositórios recebem um contexto de tenant validado e aplicam `org_id` e, quando necessário, `branch_id`.
- RLS e RPCs validam o tenant no banco. O filtro do navegador é defesa adicional, nunca autorização.
- Operações financeiras ficam em RPCs transacionais; não duplicar cálculos no browser.
- Um módulo não importa estado interno de outro módulo; integrações usam contratos públicos.
- Arquivos pequenos, uma responsabilidade por arquivo. Como referência, dividir arquivos acima de 300 linhas quando houver fronteiras funcionais claras, sem criar fragmentação artificial.
