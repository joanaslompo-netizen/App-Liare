export function syncFailureKind(error:unknown):'quota'|'blocked'|'transient' {
 const object=error as {code?:string;message?:string};
 const text=`${object?.code||''} ${object?.message||String(error)}`.toLowerCase();
 if(/resource.exhausted|quota|cota/.test(text))return 'quota';
 if(/legacy-workspace-changed|permission.denied|não autoriz|registro.*(ausente|inválido)|índice.*inválido|base pertence|identificador|destino já existe|lote seguro|número inválido/.test(text))return 'blocked';
 if(/unavailable|deadline.exceeded|network|failed to fetch|offline|aborted|conflict|revisão|backup da nuvem mudou/.test(text))return 'transient';
 return 'blocked';
}
export const retryDelay=(attempt:number)=>attempt>6?null:Math.min(10000*2**Math.max(0,attempt-1),300000);
