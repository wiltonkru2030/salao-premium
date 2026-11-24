# Homologação do Salão Premium

Registro da linha de base de 24/11/2026 e dos testes que dão aceite aos fluxos.

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Aprovado. Três entradas HTML geradas pelo Vite. |
| `npm run test:all` | A primeira execução parou no teste de serviço da Agenda. A execução individual dos 63 comandos revelou 62 conclusões com código zero e uma falha dependente do fuso. |
| `TZ=UTC npm run test:agenda` | Aprovado, inclusive o fluxo Agenda–Comanda simulado. |
| `TZ=America/Sao_Paulo npm run test:agenda` | Falhou ao tentar usar o ID do agendamento do cenário. Os horários fixos em UTC são interpretados no expediente civil local. |
| `npm run audit:structure` | Executado com 75 apontamentos. O script termina com código zero nesse modo. |
| `npm run audit:css` | Aprovado. Três entradas e 53 arquivos. |
| `npm run audit:migrations` | Código 1 por divergência de versões. O resultado coincide com a comparação das versões consultadas diretamente no Supabase. |
| Integração ativa, RLS com contas de teste, testes em navegador, acessibilidade e concorrência | A executar em homologação autorizada. A conexão Supabase disponível nesta verificação aponta para produção. |

O aceite requer pelo menos dois tenants, matriz e filial, usuários dos papéis de gestão, recepção, profissional e cliente, cenários de troca de sessão e operações concorrentes. Testar também Agenda → Comanda → Caixa → Comissão, Orçamento → Agendamento, reversões, estoque, autorização e a jornada de reserva da cliente. Capturar os resultados de teclado, toque, mobile, temas e rede degradada.

## Reteste da Agenda

Após o ajuste da fixture para horários civis, `TZ=UTC npm run test:all` e `TZ=America/Sao_Paulo npm run test:all` passaram, incluindo a suíte da Agenda. A alteração afeta somente o teste.
