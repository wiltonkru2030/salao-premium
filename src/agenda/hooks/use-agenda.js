/** Adaptador de estado da Agenda. Responsabilidade: ler e alterar navegação/filtros no estado local; não consulta o Supabase. */
import {state} from '../../state.js';
import {addDays} from '../utils/date.utils.js';
/**
 * Expõe estado e comandos de navegação da Agenda como um adaptador reativo simples.
 * @returns {object} Getters de data/visão/profissional e métodos de atualização/navegação.
 */
export function useAgenda(){return {get date(){return state.date},get view(){return state.view},get professional(){return state.pro},setDate(date){state.date=new Date(date)},setView(view){if(!['Dia','Semana','Mês'].includes(view))throw new Error('Visualização inválida.');state.view=view},setProfessional(id){state.pro=Number(id)},navigate(direction){state.date=addDays(state.date,direction*(state.view==='Semana'?7:state.view==='Mês'?30:1))},today(){state.date=new Date()}}}
