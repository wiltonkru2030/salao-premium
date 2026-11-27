# Finalização do App Profissional — FCM e autenticação

## Configuração segura de notificações
O código e a fila foram preparados; não foi realizado envio real. No Firebase, habilitar Cloud Messaging HTTP v1 e obter a configuração pública do aplicativo web e a chave VAPID pública. No build QA, definir `VITE_PROFESSIONAL_PUSH=true`, `VITE_PROFESSIONAL_FIREBASE_CONFIG` (JSON com apiKey, projectId, messagingSenderId, appId) e `VITE_PROFESSIONAL_FIREBASE_VAPID_KEY`. Não inserir credenciais de servidor em variáveis VITE.

Na Edge Function `dispatch-professional-push`, armazenar como secrets `PROFESSIONAL_FCM_PROJECT_ID`, `PROFESSIONAL_FCM_SERVICE_ACCOUNT` (JSON da conta de serviço com permissão de envio), `PROFESSIONAL_PUSH_DISPATCH_SECRET` (aleatório, pelo menos 32 caracteres). Programar POST a cada minuto por mecanismo confiável, usando header x-dispatch-secret protegido; não registrar secrets no Git. Gateway JWT desabilitado apenas para esse dispatcher de máquina, que exige secret próprio e não recebe destinatários ou conteúdo do solicitante. Preferir rotação e privilégio mínimo. O transporte usa OAuth de curta duração e FCM HTTP v1.

O worker mostra exclusivamente texto genérico, inclusive em tela bloqueada. Detalhes aparecem somente após abrir o app autenticado. A fila tem lease de dois minutos e até três tentativas por aviso/dispositivo. Não promete exatamente uma entrega externa em caso de resposta perdida; avisos do mesmo aplicativo usam tag única. Dispositivo expira para entrega após 30 dias sem registro renovado; precisa ser reativado no aplicativo. Logout tenta cancelar inscrição local e registro atual quando acessível, inclusive em troca de salão; token antigo pode permanecer no banco até expirar/invalidação FCM. Não há agendamento instalado nem envio confirmado. O projeto QA não deve receber credenciais de produção.

## Auth
A função complete-professional-password foi implantada em QA com JWT obrigatório. O gate SQL já existe. Não houve verificação real de CPF/senha: este ambiente não resolve o host HTTP QA. A função de provisionamento atualizada no Git exige implantação coordenada e ainda precisa de teste de reset simultâneo, mudança de senha e recuperação. Não ativar o gate em produção isoladamente.

## Referências
- https://firebase.google.com/docs/cloud-messaging/web/get-started
- https://firebase.google.com/docs/cloud-messaging/web/receive-messages
- https://firebase.google.com/docs/cloud-messaging/send/v1-api

### Serialização de operações de senha
Migration `20261127031423_serialize_professional_auth_operations.sql` instalada em QA. Travas privadas por profissional/conta, apenas service_role pode adquirir e liberar com identificador do detentor. Teste SQL `docs/sql/professional-auth-lock-qa.sql` aprovado. Provisionamento e conclusão compartilham a trava da conta e a conclusão confere a geração após aquisição; provisionamento usa a mesma origem de pepper do login. Trava não expira automaticamente: após falha do processo, suporte deve conferir que não existe execução em curso antes de remover somente a trava específica. Teste real Auth e corrida real de duas chamadas continuam pendentes. Produção inalterada.

### Projeto Firebase informado em 26/11/2026
Projeto `salao-premium` e chave VAPID pública integrados em `professional/firebase-public.config.js`. QA habilita push no build, produção mantém o flag falso até reconciliação do banco. Worker usa rota absoluta /professional/sw.js, escopo /professional/. Workflow Professional QA package oferece `deploy_preview` manual, canal `professional-qa`, validade de 7 dias; não publica em live. Workflow de produção e `.firebaserc` apontam ao projeto indicado. O JSON administrativo NÃO faz parte do Git nem do bundle; a chave enviada deve ser substituída/rotacionada no Google Cloud IAM. É necessário cadastrar a nova chave FCM exclusiva como secret `PROFESSIONAL_FCM_SERVICE_ACCOUNT` no Supabase QA; conta Hosting separada no secret GitHub `FIREBASE_SERVICE_ACCOUNT` se desejar publicar o preview. Acesso HTTP externo indisponível neste ambiente; entrega e hospedagem reais ainda não verificadas.
