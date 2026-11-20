# SALÃO PREMIUM — Pacotes, combos, espera e fidelidade
**Estado verificado: 20/11/2026.** Código na branch de integração; os dados operacionais existentes não foram alterados.

## Banco: mudanças aplicadas
- `20261120212042_service_packages_and_appointment_waitlist.sql`: tabelas de definição de combos, serviços/pausas e solicitações de espera; FKs compostas, validações, RLS e auditoria. Preço do combo é **referência**, não valor cobrado.
- `20261120212247_fix_customer_available_slots_date_arithmetic.sql`: corrige expressão inválida de data + timestamp na rotina de disponibilidade. Não altera os critérios de bloqueios, folgas e reservas.
- `20261120212306_service_packages_waitlist_secure_rpcs.sql`: seis RPCs autenticadas: gravar e inativar combos; incluir, listar e alterar espera; pesquisar encaixes.
- `20261120212554_atomic_waitlist_booking_and_cancel_release.sql`: efetiva encaixe com trava na solicitação, consulta de vaga e gravação de agendamento + conclusão da espera em uma transação; cancelamento pode retornar a solicitação à espera no prazo, sem criar fila duplicada.
- `20261120213452_private_customer_loyalty_overview.sql`: histórico por identidade global, com visitas concluídas, comandas quitadas e pagamentos confirmados; acesso exclusivo do titular, com vínculo ativo ao salão.
- `20261120213713_waitlist_avoid_cross_midnight_openings.sql`: evita oferecer sugestão cuja duração ultrapasse a data local de atendimento.

## Aplicação web
- Agenda administrativa: `src/agenda/pages/agenda-page.js` monta painel independente da grade, com `agenda-offers.controller.js`, `agenda-offers.service.js`, `agenda-offers.view.js` e estilos `src/styles/agenda-offers.css`.
- Cadastro e edição de combos em modal, quantidades/pausas por etapa, preço de referência, ativação/inativação e consulta por unidade. Não cria comanda nem venda.
- Lista de espera com busca de cliente, serviço, profissional opcional, intervalo de datas e horários. Busca de encaixes utiliza disponibilidade publicada; confirmação efetiva via RPC atômica, não via UI local. Contato/cancelamento exigem confirmação.
- Cliente: `cliente/services/loyaltyService.js`, `cliente/ui/loyaltyView.js` e ação “Meu relacionamento” no perfil. A tela mostra somente contagens e valores registrados no próprio vínculo autenticado, sem inventar pontos ou prêmios.
- Mantidos contexto de organização, filial, identidade e estado de carregamento para descartar respostas assíncronas antigas.

## Segurança e integridade verificadas
- RLS ativo nas três tabelas; três gatilhos de auditoria.
- Oito RPCs públicas relevantes são SECURITY INVOKER e **não** podem ser chamadas anonimamente; oito implementações privilegiadas privadas também não têm EXECUTE para anon.
- No momento da verificação havia **zero** combos, itens e inscrições de espera. Não foram inseridos dados fictícios ou realizadas reservas de teste em produção.
- O Supabase Security Advisor reportou um aviso de proteção contra senhas vazadas (configuração de Auth).
- Quatro testes novos dos serviços e views executados em harness JavaScript isolado: passaram; sete módulos integrados tiveram sintaxe validada; arquivos de teste foram ligados ao `test:all`. Sem execução confirmada de `npm run test:all`, build CI ou browser/E2E.

## Limites antes de comercializar
1. **Pacotes/combos**: falta conversão transacional para múltiplos agendamentos, preço distribuído por serviço, política de pausas que libera efetivamente o profissional, estoque, pagamentos, remarcação e cancelamento por etapa.
2. **Fidelidade**: há histórico real, mas **não** há regras de pontos, ganhos, validade, resgate, vouchers, benefícios ou débito financeiro. Não apresentar como programa de recompensas concluído.
3. **Lista de espera**: requer salão/filial publicados para encontrar vagas; a pesquisa usa profissionais/serviços elegíveis e atende à fila por sugestões, não envia automaticamente WhatsApp/SMS/push. Encaixes são apenas confirmados pela equipe.
4. **Testes**: falta ambiente QA isolado, usuários com papéis distintos, testes de RLS tenant a tenant, simulações simultâneas de encaixe, TZ/DST, comparação de saldo/estoque e testes visuais nos três aplicativos.
5. **Deploy**: branch ainda diverge de `main`, não foi feita mesclagem nem publicação nesta etapa.

A lista de espera não representa hold: a vaga só fica ocupada quando o agendamento é criado e a operação retorna sucesso. Para seguir com conversão e recompensas, as regras financeiras do salão precisam ser congeladas e homologadas com os rascunhos de comissões/refunds, sem alterações retrospectivas.
