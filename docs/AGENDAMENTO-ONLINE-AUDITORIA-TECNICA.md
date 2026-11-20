# Auditoria técnica — agendamento online

**Data:** 20/11/2026  
**Escopo:** leitura do schema Supabase e do contrato atual do aplicativo cliente.  
**Segurança:** auditoria somente leitura. Nenhuma tabela, função, policy ou dado foi alterado.

## Resultado executivo

O fluxo de agendamento online ainda não pode ser habilitado com segurança. O aplicativo mantém corretamente as operações de disponibilidade, HOLD, confirmação e liberação bloqueadas em `cliente/services/bookingService.js`, porque o backend transacional ainda não existe.

A auditoria identificou uma base operacional aproveitável (agendamentos, bloqueios, serviços, profissionais, vínculo profissional-serviço e filiais), mas também lacunas que impedem calcular horários públicos confiáveis.

## Estrutura confirmada no banco

### `appointments`
- Possui `org_id`, `branch_id`, `customer_id`, `professional_id`, `service_id`, início/fim com fuso, status, origem e preço.
- Status aceitos atualmente: `scheduled`, `confirmed`, `arrived`, `in_progress`, `completed`, `cancelled`, `no_show`.
- Origem aceita: `customer`, `salon`, `professional`.
- Possui FKs compostas para garantir que filial, cliente, profissional e serviço pertençam à mesma organização.
- Não há coluna para estado temporário de HOLD nem chave de idempotência de reserva.

### `appointment_blocks`
- Possui organização, filial, profissional opcional, início/fim e motivo.
- A FK composta garante que a filial e o profissional pertençam à organização.

### Catálogo e equipe
- `services` possui duração em minutos, preço e estado ativo.
- `professionals` possui filial, estado ativo e coluna `schedule jsonb`.
- Os exemplos de `professionals.schedule` consultados estão vazios (`{}`).
- `professional_services` associa profissional e serviço por organização.
- Não foram encontradas tabelas públicas de horários de funcionamento, turnos, folgas, disponibilidade ou HOLD com os nomes pesquisados.

### Organização e filial
- `organizations` possui fuso horário.
- `branches` possui endereço, contato e estado ativo, mas não possui colunas estruturadas de horário de funcionamento na tabela consultada.

## Trava de conflito existente

O trigger `private.prevent_appointment_overlap()`:
- rejeita intervalos inválidos;
- serializa gravações por organização + profissional usando advisory lock transacional;
- impede sobreposição com agendamentos não cancelados e não classificados como falta;
- impede sobreposição com bloqueios;
- verifica conflitos do profissional em toda a organização, não somente na filial. Isso é coerente com a regra de impedir que um profissional tenha dois atendimentos simultâneos em filiais diferentes.

### Limitações encontradas no trigger atual

1. Não conhece HOLDs temporários, portanto não impede duas clientes de disputarem o mesmo horário antes da confirmação.
2. A consulta de bloqueios não filtra `branch_id`. Como a tabela possui filial, um bloqueio de uma filial pode bloquear o profissional em outra filial. A regra correta precisa ser definida explicitamente: bloqueio pessoal do profissional em todas as filiais ou bloqueio operacional restrito à filial.
3. Não valida horário de funcionamento, expediente do profissional, pausas, folgas, duração real dos serviços ou elegibilidade do serviço na filial.
4. Não há contrato de idempotência para evitar reserva duplicada por repetição de requisição.

**Não alterar esse trigger por suposição.** A correção deve ser implementada junto do desenho completo de agenda e testada com cenários de uma e várias filiais.

## Decisões obrigatórias antes da implementação

1. Definir a fonte oficial do horário de funcionamento da filial e do expediente semanal do profissional. A coluna JSONB vazia não pode ser tratada como expediente disponível.
2. Definir folgas, pausas recorrentes, exceções por data e bloqueios pessoais/da filial.
3. Definir se uma reserva pode conter vários serviços sequenciais e como escolher um profissional compatível para cada serviço.
4. Definir política de fuso horário usando `organizations.timezone`; horários locais devem ser convertidos e persistidos como instantes com timezone.
5. Criar HOLD com expiração de cinco minutos, token opaco, usuário autenticado e chave de idempotência. HOLD expirado não pode bloquear indefinidamente.
6. A criação do HOLD deve validar novamente todos os dados no banco, dentro de uma única transação, sob trava que serialize a disputa pelo recurso/horário.
7. A confirmação deve validar titularidade, validade e expiração do HOLD e converter a reserva em agendamento de forma atômica.
8. Membership da cliente deve ser criado na mesma transação do primeiro HOLD válido, sem aceitar `org_id` como prova de autorização.
9. Cliente não terá escrita direta em `appointments`, `appointment_blocks` ou tabelas financeiras.
10. A disponibilidade exibida é apenas informativa: a confirmação final sempre depende da operação transacional no servidor.

## Plano de implementação seguro

### Etapa A — contrato de agenda
- Especificar tabelas de expediente da filial, expediente por profissional, pausas, exceções e política de bloqueios.
- Especificar reserva de múltiplos serviços e duração total.
- Revisar o impacto em agenda administrativa e profissional antes de migrar.

### Etapa B — backend transacional
- RPC privada de disponibilidade com escopo de organização/filial e serviços ativos.
- RPC de criação de HOLD com expiração de cinco minutos e idempotência.
- RPC de confirmação do HOLD.
- RPC de liberação e rotina de expiração/limpeza.
- Permissões explícitas: sem execução por `anon`; validar `auth.uid()` nas operações de cliente; funções privilegiadas em schema não exposto e com `search_path` vazio quando indispensável.

### Etapa C — proteção contra concorrência
- Testar duas sessões tentando reservar o mesmo profissional/horário simultaneamente.
- Testar profissional compartilhado entre filiais.
- Testar bloqueio pessoal versus bloqueio de filial.
- Testar expiração durante confirmação, repetição de requisição e queda de rede.
- Garantir que uma reserva confirmada não possa ser duplicada por retry.

### Etapa D — integração cliente
- Substituir os stubs de `bookingService.js` somente depois que as RPCs estiverem implantadas em QA.
- Tratar indisponibilidade, HOLD expirado, conflito, retry e falha de rede com mensagens pt-BR.
- Só mostrar confirmação após resposta positiva do backend.

## Critérios para liberar

- Migration revisada e aplicada primeiro em ambiente de QA, nunca diretamente em produção.
- Testes automatizados de concorrência e RLS com duas identidades reais.
- Testes de isolamento entre organizações e filiais.
- Testes de fuso horário, duração, pausas, folgas, bloqueios e múltiplos serviços.
- Advisors sem novos alertas críticos.
- Fluxo completo testado no navegador móvel e desktop.
- Nenhuma reserva falsa/local: o backend deve ser a fonte de verdade.

## Status

**Não pronto para produção.** A base atual protege conflitos entre agendamentos já gravados, mas não sustenta HOLDs nem disponibilidade pública completa. O aplicativo cliente continua bloqueando corretamente as operações ainda não implementadas. Nenhuma alteração foi aplicada ao banco de produção.
