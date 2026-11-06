/* Preferences, named presets and the last session, kept in this panel's local storage.
   Storage can be unavailable; every read falls back to defaults and writes report failure. */
const VectorSettings = (() => {
  const PREFS="burg-vector.prefs", PRESETS="burg-vector.presets.", LAST="burg-vector.last";
  const LEGACY="vector-effects.preset.";
  const DEFAULTS=Object.freeze({realtime:true,restore:true,graphical:true,numeric:true,large:false,
    background:"black",backgroundColor:"#202022",mutation:40});
  const BACKGROUNDS=["black","white","gray","checker","custom"];
  const read=key=>{try {return JSON.parse(localStorage.getItem(key));} catch (_) {return null;}};
  const write=(key,value)=>{try {localStorage.setItem(key,JSON.stringify(value));return true;} catch (_) {return false;}};
  const isObject=v=>v!==null && typeof v==="object" && !Array.isArray(v);

  function prefs() {
    const stored=read(PREFS), out={...DEFAULTS};
    if (!isObject(stored)) return out;
    for (const key of ["realtime","restore","graphical","numeric","large"])
      if (typeof stored[key]==="boolean") out[key]=stored[key];
    if (BACKGROUNDS.includes(stored.background)) out.background=stored.background;
    if (/^#[0-9a-f]{6}$/i.test(stored.backgroundColor)) out.backgroundColor=stored.backgroundColor;
    if (Number.isFinite(stored.mutation)) out.mutation=Math.max(0,Math.min(100,Math.round(stored.mutation)));
    return out;
  }
  const savePrefs=p=>write(PREFS,p);

  // Named presets per effect. The single "My preset" of earlier versions joins the list.
  function presets(effectId) {
    const list=read(PRESETS+effectId);
    const valid=Array.isArray(list) ? list.filter(p=>isObject(p) && typeof p.name==="string" && isObject(p.values)) : [];
    const legacy=read(LEGACY+effectId);
    if (isObject(legacy) && !valid.some(p=>p.name==="My preset")) valid.unshift({name:"My preset",values:legacy});
    return valid;
  }
  function savePreset(effectId,name,values) {
    const list=presets(effectId).filter(p=>p.name!==name);
    list.push({name,values});
    return write(PRESETS+effectId,list);
  }
  function removePreset(effectId,name) {
    if (name==="My preset") {try {localStorage.removeItem(LEGACY+effectId);} catch (_) {return false;}}
    return write(PRESETS+effectId,presets(effectId).filter(p=>p.name!==name));
  }
  function last() {
    const stored=read(LAST);
    return isObject(stored) && typeof stored.effect==="string" && isObject(stored.values) ? stored : null;
  }
  const saveLast=(effect,values)=>write(LAST,{effect,values});
  // Folded control sections, as "effect/Section title" keys.
  const FOLDS="burg-vector.folds";
  function folds() {
    const stored=read(FOLDS);
    return Array.isArray(stored) ? stored.filter(k=>typeof k==="string" && k.length<120).slice(0,200) : [];
  }
  const saveFolds=list=>write(FOLDS,list);
  return {DEFAULTS,prefs,savePrefs,presets,savePreset,removePreset,last,saveLast,folds,saveFolds};
})();
