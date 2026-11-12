export const groups=[['VISÃO GERAL','Dashboard','Agenda'],['GESTÃO','Clientes','Profissionais','Serviços','Produtos e estoque','Vendas','Comanda'],['FINANCEIRO','Caixa','Financeiro','Comissões'],['INTELIGÊNCIA','Relatórios'],['ADMINISTRAÇÃO','Unidades','Equipe e permissões','Recuperar','Configurações']];

export const glyph={'Dashboard':'Dashboard_20261112_105847_0000.svg','Agenda':'Agenda_20261112_105847_0001.svg','Clientes':'Clientes_20261112_105848_0006.svg','Profissionais':'Profissionais_20261112_105848_0007.svg','Serviços':'Serviços_20261112_105849_0020.svg','Produtos e estoque':'Estoque_20261112_105849_0022.svg','Vendas':'Vendas_20261112_105849_0019.svg','Comanda':'Vendas_20261112_105849_0019.svg','Caixa':'Caixa_20261112_105848_0012.svg','Financeiro':'Financeiro_20261112_105848_0011.svg','Comissões':'Comissões_20261112_105849_0027.svg','Relatórios':'Relatórios_20261112_105850_0032.svg','Unidades':'Documentos_20261112_105850_0039.svg','Equipe e permissões':'Equipe_20261112_105848_0008.svg','Recuperar':'Configurações_20261112_105850_0036.svg','Configurações':'Configurações_20261112_105850_0036.svg'};

export const pros=[['MC','Mariana Costa','Cabeleireira'],['AL','Ana Lima','Manicure'],['JP','João Pedro','Barbeiro']];

export const records={
'Clientes':[['Camila Rodrigues','CR','Cliente frequente','(67) 99912-3401','Última visita: 12/11/2026','R$ 1.240,00'],['Fernanda Alves','FA','Cliente VIP','(67) 99821-1150','Última visita: 10/11/2026','R$ 860,00'],['Beatriz Souza','BS','Nova cliente','(67) 99111-2233','Última visita: 08/11/2026','R$ 430,00'],['Juliana Martins','JM','Cliente frequente','(67) 99222-3344','Última visita: 06/11/2026','R$ 720,00']],
'Profissionais':[['Mariana Costa','MC','Cabeleireira','Agenda ativa','Produção: R$ 8.420'],['Ana Lima','AL','Manicure','Agenda ativa','Produção: R$ 5.230'],['João Pedro','JP','Barbeiro','Agenda ativa','Produção: R$ 6.180']],
'Serviços':[['Corte feminino','CF','Cabelo · 60 min','R$ 95,00','Ativo'],['Escova','ES','Cabelo · 45 min','R$ 65,00','Ativo'],['Coloração','CO','Coloração · 120 min','R$ 280,00','Ativo'],['Manicure','MA','Unhas · 45 min','R$ 45,00','Ativo'],['Hidratação','HI','Tratamento · 60 min','R$ 120,00','Ativo']],
'Produtos e estoque':[['Shampoo profissional','SH','SKU-001 · 18 unidades','R$ 89,90','Em estoque'],['Máscara nutritiva','MN','SKU-002 · 4 unidades','R$ 129,90','Estoque baixo'],['Óleo finalizador','OF','SKU-003 · 0 unidades','R$ 79,90','Sem estoque']],
'Vendas':[['Venda #SP-1048','SP','Camila Rodrigues · 12/11/2026','R$ 245,00','Concluída'],['Venda #SP-1047','SP','Fernanda Alves · 12/11/2026','R$ 180,00','Concluída'],['Venda #SP-1046','SP','Beatriz Souza · 11/11/2026','R$ 320,00','Concluída']],
'Caixa':[['Abertura de caixa','CX','Mariana Costa · 08:00','R$ 300,00','Aberto'],['Venda #SP-1048','VE','Camila Rodrigues · 09:42','R$ 245,00','Entrada']],
'Financeiro':[['Receita de serviços','RE','12/11/2026','R$ 2.840,00','Recebido'],['Aluguel','AL','10/11/2026','R$ 1.800,00','Pago'],['Compra de produtos','CP','09/11/2026','R$ 680,00','Pendente']],
'Comissões':[['Mariana Costa','MC','Serviços · regra de 15%','R$ 1.264,00','A apurar'],['Ana Lima','AL','Serviços · regra de 15%','R$ 784,50','A apurar']],
'Relatórios':[['Vendas por período','VP','01/11 a 12/11','R$ 18.420,00','+12,4%'],['Serviços realizados','SR','01/11 a 12/11','184 atendimentos','+8,2%'],['Novos clientes','NC','01/11 a 12/11','32 clientes','+14,0%']],
'Unidades':[['Salão Premium — Matriz','SP','Centro · Três Lagoas/MS','Unidade principal','Ativa']],
'Equipe e permissões':[['Administrador','AD','Acesso total · 2 usuários','Gerencia tudo','Ativo'],['Recepção','RE','Agenda e clientes · 3 usuários','Acesso operacional','Ativo'],['Profissional','PR','Agenda própria · 8 usuários','Acesso individual','Ativo']]
};

export const appts=[
{id:1,date:'2026-11-12',time:'09:00',name:'Camila Rodrigues',service:'Corte + escova',pro:0,status:'Confirmado',phone:'(67) 99912-3401',price:'R$ 160,00',duration:90},
{id:2,date:'2026-11-12',time:'10:00',name:'Fernanda Alves',service:'Coloração',pro:0,status:'Em atendimento',phone:'(67) 99821-1150',price:'R$ 280,00',duration:120},
{id:3,date:'2026-11-12',time:'11:00',name:'Beatriz Souza',service:'Manicure',pro:1,status:'Confirmado',phone:'(67) 99111-2233',price:'R$ 45,00',duration:45},
{id:4,date:'2026-11-12',time:'13:00',name:'Juliana Martins',service:'Hidratação',pro:2,status:'Aguardando',phone:'(67) 99222-3344',price:'R$ 120,00',duration:60},
{id:5,date:'2026-11-12',time:'15:00',name:'Larissa Oliveira',service:'Corte feminino',pro:0,status:'Confirmado',phone:'(67) 99333-4455',price:'R$ 95,00',duration:60}
];

export const config={
'Geral':[['Nome do salão','SALÃO PREMIUM'],['Idioma','Português (Brasil)'],['Moeda','Real (R$)'],['Formato de data','DD/MM/AAAA'],['Formato de hora','24 horas'],['Fuso horário','Da unidade']],
'Empresa e unidades':[['Empresa','SALÃO PREMIUM'],['Unidade selecionada','Matriz'],['Endereço','Três Lagoas · MS'],['Contato','A configurar'],['Situação','Demonstração']],
'Agenda':[['Profissionais no topo','Ativado'],['Duração calculada pelo serviço','Ativado'],['Ajuste manual de duração','Somente autorizados'],['Intervalo entre atendimentos','10 minutos'],['Antecedência mínima','2 horas'],['Sobreposição de horários','Desativada']],
'Profissionais':[['Cadastro de profissionais','A configurar'],['Vínculo com unidades','Por profissional'],['Serviços permitidos','Por especialidade'],['Comissões','Configuradas por regra'],['Exibição na agenda','Foto e nome']],
'Serviços e catálogo':[['Categorias','A configurar'],['Duração padrão','Definida por serviço'],['Preço','Por unidade'],['Disponibilidade pública','A configurar'],['Fotos e descrições','A configurar']],
'Clientes':[['Cadastro de clientes','A configurar'],['Campos obrigatórios','Nome e contato'],['Duplicidade','Validar telefone/e-mail'],['Histórico','Restrito por permissão'],['Comunicações','Com consentimento']],
'Agendamento e políticas':[['Confirmação','A configurar'],['Cancelamento','A configurar'],['Antecedência','A configurar'],['Sinal / pagamento antecipado','A configurar'],['Faltas (no-show)','A configurar']],
'Notificações':[['Confirmação de agendamento','A configurar'],['Lembretes','A configurar'],['Cancelamentos','A configurar'],['Canais','E-mail / WhatsApp (futuro)'],['Consentimento','Obrigatório']],
'Financeiro e comissões':[['Moeda','BRL · R$'],['Fechamento de caixa','Por unidade'],['Regras de comissão','Por profissional/serviço'],['Descontos','Somente autorizados'],['Conciliação','A configurar']],
'Aparência e marca':[['Identidade visual','SALÃO PREMIUM'],['Fundo','Branco'],['Fonte dos títulos','Body Grotesque Fit'],['Fonte da interface','Poppins Medium'],['Ícones','Biblioteca SVG do projeto']],
'Usuários e segurança':[['Perfis de acesso','Administrador / Recepção / Profissional'],['Permissões','Por módulo e ação'],['Autenticação','A implementar'],['Sessões e dispositivos','A implementar'],['Auditoria','A implementar']],
'Plano e assinatura':[['Plano atual','Demonstração'],['Cobrança','Não conectada'],['Próxima cobrança','Não definida'],['Forma de pagamento','Não cadastrada'],['Status','Sem assinatura ativa']]
};
