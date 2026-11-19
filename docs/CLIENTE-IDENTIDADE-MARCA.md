# Identidade única da cliente por marca

## Regra de negócio

- Uma conta de cliente por organização/marca, não uma conta por filial.
- A reserva continua apontando para a unidade física escolhida.
- Histórico, pacotes e fidelidade poderão ser consolidados por meio da identidade da marca.
- A conta Supabase Auth é a identidade de login; não usar telefone, CPF ou data de nascimento como identificador de autenticação.
- Data de nascimento é dado de perfil e não prova de identidade.

## Descoberta do banco atual

A inspeção somente de leitura encontrou:

- A tabela `customers` já pertence a uma organização e possui `branch_id` opcional.
- `appointments` aponta para `customers` por uma FK composta `(org_id, customer_id)`.
- Há 17 cadastros de clientes no projeto e 15 agendamentos ligados a cliente.
- 14 dos 17 cadastros não têm telefone. Portanto, não é seguro unir cadastros existentes por telefone nem inferir identidade a partir dos dados atuais.
- A tabela `customers` não possui vínculo com `auth.users`.

## Modelo aditivo proposto

1. `customer_accounts`: identidade da cliente por `(org_id, auth_user_id)`, nome e data de nascimento.
2. `customer_account_customers`: tabela de associação entre a identidade da marca e um ou mais cadastros operacionais antigos em filiais.
3. Os registros atuais de `customers` e `appointments` permanecem intactos.
4. A associação de registros antigos será feita por funcionário autorizado após confirmar a identidade da pessoa. Não fazer merge automático.
5. O cadastro novo usa uma RPC que obtém `auth.uid()` do token; o navegador não escolhe o ID de usuário.
6. A cliente pode ler somente a própria conta e os vínculos dela. A equipe autorizada pode consultar e vincular registros dentro da própria organização.
7. Nenhuma permissão de leitura de agendamentos, comandas, pagamentos ou finanças será concedida nesta primeira etapa.

## Fluxo de login e cadastro

- Google ou Passkey autentica a identidade no Supabase Auth.
- O link público da marca identifica a organização pelo slug.
- Após login, a cliente informa nome e, opcionalmente, data de nascimento.
- A RPC cria uma conta por marca e é idempotente para a mesma conta Auth.
- A data de nascimento nunca libera acesso nem substitui confirmação de identidade.
- Para vincular um cadastro legado, a recepção confirma a cliente. No futuro, um telefone só poderá automatizar essa ligação após verificação real por OTP.

## Arquivo SQL

O SQL de referência está em [docs/sql/cliente-identidade-marca.sql](sql/cliente-identidade-marca.sql). É um rascunho, não uma migration aplicada. O Supabase CLI não está instalado neste ambiente; antes de virar migration oficial, executar `supabase migration new cliente_identidade_marca` e revisar o arquivo gerado.

## Próximas etapas

1. Gerar migration oficial com Supabase CLI.
2. Aplicar somente em projeto de desenvolvimento/staging.
3. Rodar testes de RLS com duas clientes, duas marcas e dois cadastros de filiais.
4. Revisar Supabase Security Advisors.
5. Criar fluxo de vinculação auditado para equipe.
6. Implementar histórico consolidado com RPC/view segura e depois o fluxo de agendamento por unidade.
