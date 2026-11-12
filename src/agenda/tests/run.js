import {runAgendaUnitChecks} from './agenda.test.js';
import {runConflictUnitChecks} from './conflicts.test.js';
import {runAgendaServiceChecks} from './services.test.js';

const suites=[
  ['Datas e duração',runAgendaUnitChecks()],
  ['Conflitos e validações',runConflictUnitChecks()],
  ['Serviço da agenda',runAgendaServiceChecks()]
];
let failed=0;
for(const [name,result] of suites){
  console.log('\n'+name+': '+result.passed+'/'+result.total);
  for(const [label,ok] of result.checks){
    console.log((ok?'  ✓ ':'  ✗ ')+label);
    if(!ok)failed++;
  }
}
console.log('\nResultado: '+(failed?'FALHOU ('+failed+' erro(s))':'TODOS OS TESTES PASSARAM'));
if(failed)process.exitCode=1;
