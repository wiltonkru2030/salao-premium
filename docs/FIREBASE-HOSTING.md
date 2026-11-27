# Publicação do GitHub no Firebase Hosting

O workflow `.github/workflows/firebase-hosting.yml` publica o build da branch escolhida manualmente em **Actions → Firebase Hosting → Run workflow**. O build contém o painel (`/`), a Área da Cliente (`/cliente/`) e o App Profissional (`/professional/`). O arquivo `firebase.json` define as rotas para essas três entradas.

## Configuração no GitHub

Em **Settings → Secrets and variables → Actions**, configure:

| Tipo | Nome | Valor |
| --- | --- | --- |
| Variable | `FIREBASE_PROJECT_ID` | ID do projeto Firebase que receberá o Hosting. |
| Variable | `VITE_SUPABASE_URL` | URL do projeto Supabase correspondente ao ambiente publicado. |
| Variable | `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável do mesmo projeto Supabase. |
| Secret | `FIREBASE_SERVICE_ACCOUNT` | JSON integral de uma conta de serviço autorizada a publicar no Firebase Hosting do projeto. |

Crie ou vincule o projeto no Firebase Console, ative o Hosting e conceda à conta de serviço apenas as permissões necessárias para publicar. Guarde o JSON somente como secret do GitHub. O workflow falha antes do build se qualquer configuração estiver ausente. A chave `service_role` do Supabase nunca deve ser usada neste workflow.

Antes de publicar a Área da Cliente com Google OAuth, cadastre o domínio `web.app` ou domínio personalizado e os redirects necessários no Supabase Auth e no provedor Google. Confira também links de redefinição de senha e resposta a orçamento no endereço publicado.

O Hosting distribui os arquivos do build. Ele não transfere banco, migrations, usuários, Edge Functions ou configurações do Supabase. A liberação comercial depende dos critérios de homologação em [STATUS-2026-11-24.md](STATUS-2026-11-24.md).

## Promoção explícita da central de notificações (27/11/2026)
A atualização do manifesto `docs/releases/professional-notifications-live.json` dispara uma publicação live somente na main. Commits comuns continuam sem publicar. O workflow exige URL de produção, conta de serviço do Firebase correto, testes agregados, regressão visual e verificação do SHA atual. O build mantém FCM desabilitado e ativa somente os contratos de central/preferências já instalados. Após o deploy, compara bytes das três entradas e do worker com o build. O disparo manual permanece disponível. Não considerar publicada até o workflow concluir e o smoke confirmar.
