export const RENEWAL_SAVE_KEY='hamster-mining-renewal-v1';
export const gameSaveKey=(renewal,legacyKey)=>renewal?RENEWAL_SAVE_KEY:legacyKey;

// Keep classic progress untouched. Only migrate a save already using the renewal mine.
export function readGameSave(storage,renewal,legacyKey){
 const current=storage.getItem(gameSaveKey(renewal,legacyKey));
 if(current!==null||!renewal)return current;
 const previous=storage.getItem(legacyKey);
 try{return JSON.parse(previous)?.renewal?.version===1?previous:null;}catch{return null;}
}
export function needsPrologue(state,renewal){
 return renewal?state.renewal.prologueSeen!==true:!state.prologueSeen;
}
export function completePrologue(state,renewal){
 state.prologueSeen=true;
 if(renewal)state.renewal.prologueSeen=true;
}
