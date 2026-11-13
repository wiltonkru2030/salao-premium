# SALÃO PREMIUM

Sistema de gestão para salões de beleza, com painel administrativo e App Profissional.

## Princípios do projeto

1. **Uma identidade visual:** páginas administrativas reutilizam tokens, tipografia, botões, campos, cartões, estados e modais definidos em `src/styles/design-system.css`.
2. **Dados integrados:** clientes, profissionais, serviços, Agenda, Comandas, Caixa e Comissões devem compartilhar os mesmos identificadores e respeitar a organização e a unidade.
3. **Segurança no servidor:** permissões, cálculos financeiros e alterações críticas são validados no Supabase; a interface não é autoridade de segurança.
4. **Histórico preservado:** pagamentos, comissões, estornos e auditoria não devem ser apagados ou alterados silenciosamente.
5. **Erros compreensíveis:** mensagens para usuários em português; detalhes técnicos ficam no console com código de diagnóstico.
6. **Documentação junto do código:** módulos e funções de domínio devem explicar responsabilidade, entradas, efeitos e integrações.

## Estrutura principal

- `src/app.js`: inicialização do painel, eventos globais e coordenação dos módulos.
- `src/pages/`: páginas administrativas por domínio.
- `src/agenda/`: implementação modular da Agenda.
- `src/styles/`: estilos compartilhados e design system.
- `src/utils/errors.js`: tradução segura e registro centralizado de erros.
- `professional/`: App Profissional.
- `supabase/migrations/`: alterações incrementais de banco.
- `supabase/functions/`: funções de servidor.

## Documentação

- [Arquitetura e integrações](docs/ARCHITECTURE.md)
- [Identidade visual e CSS global](docs/DESIGN_SYSTEM.md)
- [Tratamento de erros e mensagens](docs/ERROR_HANDLING.md)
- [Regras de Comissões](docs/COMMISSIONS.md)

## Estado do design system

O CSS global já possui uma camada compartilhada e é importado pelo `styles.css`. Isso **não significa que a migração visual de todas as páginas esteja concluída**: ainda existem folhas antigas e estilos específicos por módulo. A conclusão exige revisar cada tela, remover conflitos e validar desktop e celular.

## Desenvolvimento seguro

- Não apagar nem recriar o banco para corrigir uma funcionalidade.
- Criar migrations aditivas, revisar permissões RLS e testar com dados isolados.
- Nunca colocar segredos, senhas, tokens ou dados pessoais nos logs.
- Não declarar uma funcionalidade concluída apenas porque o build passou; fluxos financeiros precisam de testes integrados.
