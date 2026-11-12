# Guia técnico e mapa do código — SALÃO PREMIUM

Este documento descreve a estrutura real do repositório e serve como índice para manutenção. Atualize-o sempre que mover módulos ou alterar contratos.

## 1. Visão geral

O projeto é uma aplicação web JavaScript com ES Modules, HTML e CSS. O painel administrativo e o App Profissional são duas entradas separadas que compartilham o cliente Supabase e alguns componentes.

- `index.html`: documento HTML e tela de erro de inicialização do painel.
- `app.js`: ponto de entrada mínimo; importa `src/app.js`.
- `src/app.js`: inicialização, eventos globais, fluxo da Agenda e integração entre páginas. **Arquivo concentrador que precisa ser dividido em controladores menores.**
- `professional/index.html`: entrada PWA do App Profissional.
- `professional/app.js`: interface, navegação, autenticação e carregamento do App Profissional. **Arquivo concentrador que precisa ser dividido por módulo.**

## 2. Mapa das pastas

| Caminho | Responsabilidade |
|---|---|
| `src/auth/` | Login, sessão, saída e tela de autenticação do painel |
| `src/layout/` | Shell administrativo, menu e renderização das páginas |
| `src/pages/` | Páginas de negócio: clientes, profissionais, serviços, produtos, comandas, comissões etc. |
| `src/components/` | Componentes reutilizáveis, como drawer, autocomplete e campos compartilhados |
| `src/agenda/` | Módulo Agenda separado em páginas, componentes, serviços, utilitários, estilos e testes |
| `src/supabase/` | Cliente Supabase e serviços de acesso a dados |
| `src/utils/` | Máscaras, formatação, escape HTML e tratamento de erros compartilhados |
| `src/styles/` | Estilos base, shell, componentes, formulários, listas, modais e responsividade |
| `professional/` | PWA e interface do profissional |
| `supabase/functions/` | Edge Functions de acesso profissional e login por CPF |
| `supabase/migrations/` | Alterações versionadas do banco e políticas de segurança |
| `.github/workflows/` | Validação de sintaxe/build e testes automatizados |

## 3. O que está separado e o que ainda está concentrado

### Separado
- As páginas administrativas têm arquivos próprios em `src/pages/`.
- A Agenda tem estrutura modular própria em `src/agenda/`.
- Autenticação, layout, componentes, estilos, funções de backend e migrações têm diretórios específicos.
- O App Profissional tem entrada, HTML, CSS, manifesto e service worker próprios.

### Ainda concentrado ou duplicado
- `src/app.js` contém muitas responsabilidades: eventos de interface, operações de Agenda, validações, comandas e integração com o banco.
- `professional/app.js` concentra telas, estado, autenticação, consultas e ações do profissional.
- `src/pages/professionals.js` e `src/pages/comanda.js` são arquivos grandes que misturam renderização, consulta, validação e gravação.
- `src/supabase/data-service.js` oferece operações genéricas, mas várias páginas consultam Supabase diretamente; o padrão de acesso a dados não é uniforme.
- Existem dois arquivos de estilos globais e estilos locais: o painel usa `styles.css` como agregador; o App Profissional importa o design system e acrescenta regras próprias. A consolidação visual precisa preservar as diferenças funcionais sem duplicar tokens.
- A Agenda tem serviços locais legados em `src/agenda/services/`; o fluxo administrativo atual também consulta o Supabase em `src/agenda/pages/agenda-page.js` e `src/app.js`. O README antigo da Agenda precisa ser alinhado com o fluxo real.

## 4. Responsabilidade dos arquivos principais

- `src/state.js`: estado compartilhado da sessão e da interface.
- `src/utils.js`: escape de HTML, toast, botões, cabeçalhos, métricas e helpers visuais.
- `src/utils/input-masks.js`: máscaras e conversão de valores brasileiros.
- `src/utils/errors.js`: mensagens seguras, registro de erros e captura de rejeições globais.
- `src/supabase/client.js`: configuração do cliente Supabase. A chave publishable pode estar no frontend; nunca colocar service_role/secret key aqui.
- `src/supabase/data-service.js`: operações genéricas de leitura, criação, atualização e exclusão com escopo de organização.
- `src/layout/render.js`: composição do shell e roteamento das páginas.
- `src/components/drawer.js`: painel de detalhes/edição compartilhado.
- `src/pages/*.js`: tela e ações de cada módulo de negócio.
- `src/agenda/pages/agenda-page.js`: consulta de dados da Agenda e composição do calendário.
- `src/agenda/components/*.js`: partes visuais da Agenda.
- `src/agenda/utils/*.js`: regras de data, duração e conflitos.
- `src/agenda/tests/*.js`: testes automatizados da Agenda.
- `professional/app.js`: aplicação profissional independente; deve ser dividido em módulos de agenda, comandas, comissões, autenticação e shell.

## 5. Padrão obrigatório para novos arquivos

Todo arquivo de código deve começar com um bloco curto:

```js
/**
 * Módulo: [nome da funcionalidade]
 * Responsabilidade: [o que este arquivo faz]
 * Dependências: [serviços/componentes utilizados]
 * Não faz: [responsabilidade que pertence a outro módulo]
 */
```

Funções exportadas devem ter comentário JSDoc quando seu contrato não for óbvio. Comentários devem explicar intenção, regra de negócio e efeitos colaterais — não repetir literalmente cada linha.

## 6. Padrão obrigatório de tratamento de erros

1. Validar dados antes de chamar o banco.
2. Verificar `error` em toda resposta Supabase.
3. Em operações assíncronas de interface, usar `try/catch/finally`.
4. Desabilitar o botão durante gravação e reabilitá-lo em `finally`.
5. Mostrar mensagem simples e segura ao usuário.
6. Registrar contexto técnico no console com o identificador SP-... gerado por `reportError`.
7. Não expor stack trace, SQL, tokens, CPF, senha ou dados pessoais em mensagens.
8. Não ignorar falhas de consultas auxiliares: se um dado for necessário para a operação, a falha deve ser tratada.
9. Toda operação sensível deve ter validação e autorização no servidor/RLS; validação no navegador não substitui segurança do backend.

Exemplo:

```js
import { reportError } from "../utils/errors.js";

try {
  submitButton.disabled = true;
  await saveRecord(values);
} catch (error) {
  reportError(error, { context: "Clientes > salvar cadastro" });
} finally {
  submitButton.disabled = false;
}
```

## 7. Pontos de atenção identificados na auditoria

- O README anterior dizia que os dados da Agenda eram somente demonstrativos e em memória, mas a página administrativa atual consulta e grava dados no Supabase. Documentação desatualizada pode levar a manutenção errada.
- O `src/app.js` possui fluxo de Agenda e listeners globais em um único arquivo, dificultando isolar regressões.
- O `professional/app.js` concentra diversas telas e fluxos de dados.
- O tratamento de erros varia entre páginas: algumas capturam erros, outras apenas verificam respostas pontuais, e outras dependem de rejeições assíncronas.
- O `src/pages/professionals.js` inicia quatro consultas paralelas, mas precisa verificar os erros de todas elas e da consulta adicional de perfis antes de montar a tela.
- Em `src/pages/comanda.js`, a consulta de detalhes ignora erros com código 42501 em consultas auxiliares. Isso pode mascarar falta de permissão e deixar a tela parcialmente incompleta.
- O documento `index.html` possui um capturador de erro de inicialização que também pode reagir a erros JavaScript após o início da aplicação; o escopo dele deve ser limitado à fase de boot.
- A pasta `src/pages/` contém módulos curtos de encaminhamento e páginas maiores; isso não é necessariamente erro, mas a convenção deve ficar explícita.

## 8. Ordem segura de reorganização

1. Centralizar erros, validações e logs sem alterar regras de negócio.
2. Dividir `src/app.js` em controladores por funcionalidade.
3. Dividir `professional/app.js` em módulos de autenticação, Agenda, Comandas, Comissões e shell.
4. Separar em cada página: consulta de dados, renderização, validação e ações de gravação.
5. Padronizar o acesso ao Supabase e verificar todos os erros auxiliares.
6. Consolidar os estilos globais e eliminar regras duplicadas após comparação visual.
7. Adicionar testes de cada fluxo antes de remover código legado.

**Regra:** refatorar uma funcionalidade por vez, preservar contratos e executar build/testes após cada etapa. Não reescrever vários módulos críticos simultaneamente.
