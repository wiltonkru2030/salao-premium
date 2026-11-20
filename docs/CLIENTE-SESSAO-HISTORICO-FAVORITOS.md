# Área da Cliente — sessão, histórico, reserva e preferências

Data: 20/11/2026. Alterações na branch de integração; nenhuma transação fictícia foi criada.

## Migrations aplicadas e verificadas
- 20261120163051_customer_appointment_history: função pública invoker, implementação privada com identidade autenticada e vínculo ativo. Sem identidade retorna 0 registros. Sem EXECUTE para anon.
- 20261120163441_customer_coupon_confirmation_idempotent: confirmação repetida retorna o agendamento anterior sem reaplicar preço/cupom. Sem EXECUTE público para anon.
- 20261120163536_customer_favorites_and_preferences: favoritos com RLS por auth_user_id, somente leitura/inserção/exclusão próprias; listas e preferências por RPC. Sem acesso anônimo; sem UPDATE direto da tabela de favoritos.
- Rascunho de engajamento retirado do diretório de execução automática e mantido em docs/sql/customer-engagement.draft.sql. Favoritos privados não devem entrar no log administrativo do salão; auditar privadamente em etapa própria. Notificações ainda não implantadas.

## Código
O evento Auth apenas atualiza o contexto; o acesso ao banco ocorre fora do callback via tarefa agendada. Troca de conta invalida respostas antigas e limpa dados de perfil, agenda, favoritos, notificações, localização, catálogo e reserva. Preferências locais são separadas por identidade, sem migração da antiga chave compartilhada. O filtro de profissional/data deve coincidir com os horários consultados; a confirmação exibe o serviço, profissional e horário e verifica expiração. O banco permanece a autoridade definitiva.

14 verificações estáticas feitas em arquivos relidos; testes de preferências ampliados e contratos atualizados. A suíte Node e testes reais de duas identidades, reservas em paralelo, login Google/passkey, configuração OAuth, recuperação e cancelamento/reagendamento pela cliente, notificações push/WhatsApp e aplicativos nativos ainda precisam de homologação. O bloqueio visual de reserva não garante sucesso de RPC. A política de favoritos permanece por marca, com unidades publicadas na lista.

Não publicar como produto concluído antes da homologação. Corrigir a candidata de notificações e revisar autorização dos endpoints, isolamento por conta, fuso de horário da unidade e estado de reserva após perda de conexão.
