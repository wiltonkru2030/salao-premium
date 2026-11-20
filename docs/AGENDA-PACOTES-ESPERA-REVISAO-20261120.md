# Agenda complementar — revisão de 20/11/2026

## Conferência
No banco real, tabelas `service_packages`, `service_package_items` e `appointment_waitlist` e sete RPCs correspondentes já existiam. Execução das RPCs permitida a `authenticated` e negada a `anon`; as tabelas usam leitura RLS por papel de equipe. Não houve migration ou escrita de dados neste trabalho.

## Correções nesta etapa
O controlador `src/agenda/controllers/agenda-offers.controller.js` agora invalida consultas de encaixe e catálogo ao trocar de organização, unidade ou papel; ignora respostas de sessões anteriores; e confere a identidade do estado antes de exibir resultados de gravações. Adicionado teste estático `test:agenda-offers-session` à suíte. Seis expressões verificadas no texto; execução de Node, CI e navegador ainda não confirmadas.

## Limites
- Cadastro de combos armazena serviços, quantidades e pausas, mas não agenda grupo automaticamente nem gera comanda ou cobrança.
- Encaixes exigem confirmação e são efetivados pela RPC transacional; disponibilidade precisa ser revalidada no servidor. Não há notificações automáticas de oportunidade ou agendamento por pacote.
- Programa de fidelidade e resgate de benefícios não foram implementados nesta etapa.
- Testes de dois usuários, concorrência real, fuso horário e dispositivo móvel continuam pendentes.
