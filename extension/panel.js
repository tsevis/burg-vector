(() => {
  "use strict";
  const $=id=>document.getElementById(id), G=VectorGeometry, S=VectorSettings, W=VectorWidgets;
  const bridge=window.__adobe_cep__;
  const FAMILY=9, PARENT=4, VARY=0.12;
  const values=new Map(), widgets=new Map(), beforeVariation=new Map();
  let prefs=S.prefs(), effect=VectorCatalog[0], mode="tweak", family=[], presetName="Default";
  let token=null,busy=false,result=null,original=false,frame=0,saveTimer=0;
  let source=bridge ? [] : sample();
  let revision=null,reading=false,inspectNext=false,timer=0,epoch=0;
  let idleMessage="Looking for selected artwork…";

  const defaults=e=>Object.fromEntries(e.controls.map(c=>[c.key,c.value]));
  const params=()=>values.get(effect.id);
  const status=(msg,error=false)=>{$("status").textContent=msg;$("status").dataset.error=error;};
  // Stored values are kept only where they are still valid for the control.
  function sanitize(e,data) {
    const out=defaults(e);
    for (const c of e.controls) {
      const v=data && data[c.key];
      if (c.options ? c.options.includes(v) : c.color ? /^#[0-9a-f]{6}$/i.test(v) :
        Number.isFinite(v) && v>=c.min && v<=c.max) out[c.key]=v;
    }
    return out;
  }
  function sample() {
    const n=48,points=[];
    // A lobed seal with an open counter makes curvature and compound holes visible.
    for (let i=0;i<n;i++) {
      const a=i*2*Math.PI/n,r=50+8*Math.cos(8*a),dr=-64*Math.sin(8*a);
      const x=r*Math.cos(a),y=r*Math.sin(a),k=2*Math.PI/(n*3);
      const dx=k*(dr*Math.cos(a)-r*Math.sin(a)),dy=k*(dr*Math.sin(a)+r*Math.cos(a));
      points.push([x,y,x-dx,y-dy,x+dx,y+dy]);
    }
    return [{paths:[{closed:true,points},G.circle(0,0,17)],fill:[73,99,158],stroke:null,width:0,opacity:100,evenodd:true}];
  }
  function host(script) {
    return new Promise((resolve,reject)=>{
      bridge.evalScript(script,text=>{
        try {const data=JSON.parse(text); if (data.error) throw Error(data.error);resolve(data);}
        catch(e){reject(Error(text==="EvalScript error." ? "Illustrator could not load the panel bridge. Reopen the panel." : e.message));}
      });
    });
  }
  const stage=VectorStage($("preview"),{effect:()=>effect,params,source:()=>source,result:()=>result,
    original:()=>original,set:(key,v,final)=>set(key,v,final)});

  /* ---------- Preferences ---------- */
  function applyPrefs() {
    document.body.classList.toggle("numeric",prefs.numeric);
    document.body.classList.toggle("large",prefs.large);
    const canvas=$("canvas");
    canvas.className="canvas bg-"+prefs.background;
    canvas.style.setProperty("--well",prefs.background==="custom" ? prefs.backgroundColor : "");
  }
  function openPrefs() {
    const form=$("prefs").querySelector("form");
    for (const key of ["realtime","restore","graphical","numeric","large"]) form.elements[key].checked=prefs[key];
    form.elements.background.value=prefs.background;form.elements.backgroundColor.value=prefs.backgroundColor;
    $("prefs").returnValue="";$("prefs").showModal();
  }
  $("prefs").addEventListener("close",()=>{
    if ($("prefs").returnValue!=="ok") return;
    const f=$("prefs").querySelector("form").elements;
    prefs={...prefs,realtime:f.realtime.checked,restore:f.restore.checked,graphical:f.graphical.checked,
      numeric:f.numeric.checked,large:f.large.checked,background:f.background.value,backgroundColor:f.backgroundColor.value};
    if (!S.savePrefs(prefs)) status("Preferences apply now but could not be saved.",true);
    applyPrefs();if (!$("drawer").hidden) drawer();
  });
  $("prefs").querySelector("input[name=backgroundColor]").addEventListener("input",e=>{
    e.target.form.elements.background.value="custom";
  });

  /* ---------- Controls ---------- */
  function limits(c) {
    const contours=source.flatMap(s=>s.paths);
    if (effect.id!=="point" || !contours.length) return c;
    if (c.key==="contour") return {...c,max:Math.min(c.max,contours.length)};
    if (c.key==="index") {
      const target=contours[params().contour-1];
      return {...c,max:Math.min(c.max,target ? target.points.length : Math.max(...contours.map(p=>p.points.length)))};
    }
    return c;
  }
  function buildControls() {
    const root=$("controls");root.replaceChildren();widgets.clear();
    let section=null,grid=null;
    for (const raw of effect.controls) {
      if (effect.id==="point" && ["dx","dy"].includes(raw.key) && !params().mode.startsWith("Move")) continue;
      const c=limits(raw);
      if (!c.options && !c.color) params()[c.key]=Math.min(params()[c.key],c.max);
      if (!section || raw.section) {
        section=document.createElement("section");section.className="section";
        const h=document.createElement("h3");h.textContent=raw.section || "Adjustments";
        grid=document.createElement("div");grid.className="grid";
        section.append(h,grid);root.append(section);
      }
      const w=W.control(c,params()[c.key],(v,final)=>set(c.key,v,final,true));
      widgets.set(c.key,w);grid.append(w.el);
    }
  }
  // Changes from widgets, handles and Explore all arrive here.
  function set(key,v,final=false,fromWidget=false) {
    if (key!==null) {
      const c=effect.controls.find(p=>p.key===key);
      if (!c) return;
      const value=c.options || c.color ? v : Math.max(c.min,Math.min(c.max,fromWidget ? v : Math.round(v)));
      params()[key]=value;
      if (!fromWidget && widgets.has(key)) widgets.get(key).set(value);
      presetName=null;original=false;
      // Rebuilding replaces the pill being dragged, so a contour change waits for release.
      if (effect.id==="point" && (key==="mode" || (key==="contour" && final))) buildControls();
    }
    if (prefs.realtime || final) schedule();
    remember();
  }
  function remember() {
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>S.saveLast(effect.id,Object.fromEntries(values)),400);
  }
  function setParams(data,name=null) {
    values.set(effect.id,sanitize(effect,data));presetName=name;original=false;
    buildControls();renderNow();remember();
    if (mode==="explore") breed();
  }
  function selectEffect(id) {
    effect=VectorCatalog.find(e=>e.id===id) || VectorCatalog[0];
    if (!values.has(effect.id)) values.set(effect.id,defaults(effect));
    $("effect").value=effect.id;$("effect-name").textContent=effect.name;
    presetName=JSON.stringify(params())===JSON.stringify(defaults(effect)) ? "Default" : null;
    original=false;buildControls();renderNow();remember();
    if (!$("drawer").hidden) drawer();
    if (mode==="explore") breed();
  }

  /* ---------- Rendering ---------- */
  function sync() {
    $("apply").disabled=busy || !token || !result;
    $("compare").disabled=!source.length;
    $("effect").disabled=busy;
    $("vary").disabled=busy || !result;
    $("remove").disabled=!presetName || !S.presets(effect.id).some(p=>p.name===presetName);
    $("compare").textContent=original ? "Show effect" : "Show original";
    $("compare").setAttribute("aria-pressed",String(original));
  }
  function renderNow() {
    if (frame) {cancelAnimationFrame(frame);frame=0;}
    $("prompt").hidden=!!source.length;
    if (!source.length) {result=null;status("");$("prompt").textContent=idleMessage;stage.draw();sync();return;}
    try {
      result=VectorEffects.run(effect.id,source,params());
      const anchors=result.reduce((n,s)=>n+s.paths.reduce((sum,p)=>sum+p.points.length,0),0);
      if (token) status(result.length+" vector "+(result.length===1?"object":"objects")+" · "+anchors+" anchors");
      else if (!bridge) status("Sample preview. Open the panel in Illustrator to use your artwork.");
    } catch (e) {result=null;status(e.message,true);}
    stage.draw();sync();
  }
  function schedule() {
    if (!frame) frame=requestAnimationFrame(()=>{frame=0;renderNow();});
  }
  const attempt=values=>{try {return VectorEffects.run(effect.id,source,values);} catch (e) {return e;}};
  function tile(shapes,cls,label) {
    const button=document.createElement("button");button.type="button";button.className=cls;
    if (shapes instanceof Error) {
      const why=document.createElement("span");why.className="failed";why.textContent=shapes.message;button.append(why);
    } else button.append(VectorRender.thumbnail(shapes));
    if (label) {const name=document.createElement("span");name.textContent=label;button.append(name);}
    return button;
  }

  /* ---------- Explore ---------- */
  function breed(parent=params()) {
    family=Array.from({length:FAMILY},(_,i)=>i===PARENT ? {...parent} :
      VectorExplore.mutate(effect,parent,prefs.mutation/100));
    const grid=$("explore");grid.replaceChildren();
    if (!source.length) return;
    family.forEach((child,i)=>{
      const t=tile(attempt(child),"tile"+(i===PARENT ? " parent" : ""));
      t.title=i===PARENT ? "Current settings" : "Adopt this variation";
      t.setAttribute("aria-label",t.title);
      t.onclick=()=>{
        if (i===PARENT) {setMode("tweak");return;}
        beforeVariation.set(effect.id,{...params()});
        setParams(family[i]);status("Adopted a variation. Its children are shown around it.");
      };
      grid.append(t);
    });
  }
  function setMode(next) {
    mode=next;
    $("mode-tweak").setAttribute("aria-pressed",String(mode==="tweak"));
    $("mode-explore").setAttribute("aria-pressed",String(mode==="explore"));
    $("explore").hidden=$("explore-bar").hidden=mode!=="explore";
    for (const id of ["zoom-in","zoom-out","pan"]) $(id).disabled=mode==="explore";
    if (mode==="explore") {breed();status("Click a variation to adopt it. The centre tile is the current setting.");}
    else renderNow();
  }
  function exploreBar() {
    const bar=$("explore-bar");
    const amount=W.scrubber({key:"mutation",label:"Mutation",min:0,max:100,step:1,unit:"%"},prefs.mutation,(v,final)=>{
      prefs={...prefs,mutation:v};if (final) {S.savePrefs(prefs);breed();}
    });
    const again=document.createElement("button");again.type="button";again.className="pill small";again.textContent="New family";
    again.onclick=()=>breed();
    bar.append(amount.el,again);
  }

  /* ---------- Presets ---------- */
  function presetChoices() {
    const list=[{name:"Default",values:{}},{name:effect.preset[0],values:effect.preset[1]}];
    for (const p of S.presets(effect.id)) list.push({...p,user:true});
    if (beforeVariation.has(effect.id)) list.push({name:"Before variation",values:beforeVariation.get(effect.id)});
    return list;
  }
  function drawer() {
    const list=$("preset-list");list.replaceChildren();
    list.classList.toggle("text",!prefs.graphical);
    for (const p of presetChoices()) {
      const shown=sanitize(effect,p.values);
      const item=prefs.graphical && source.length ? tile(attempt(shown),"preset",p.name) : tile([],"preset",p.name);
      if (!prefs.graphical) item.querySelector("svg").remove();
      item.setAttribute("aria-current",String(p.name===presetName));
      item.onclick=()=>{setParams(p.values,p.name);drawer();status("Preset: "+p.name+".");};
      list.append(item);
    }
  }
  function toggleDrawer(open=$("drawer").hidden) {
    $("drawer").hidden=!open;$("presets-btn").setAttribute("aria-expanded",String(open));
    if (open) drawer();
  }
  $("save-form").addEventListener("submit",e=>{
    e.preventDefault();
    const name=$("preset-name").value.trim();
    if (!name) {$("preset-name").focus();return;}
    if (["Default","Before variation",effect.preset[0]].includes(name)) {status("Choose another name; that one is built in.",true);return;}
    if (S.savePreset(effect.id,name,{...params()})) {presetName=name;$("preset-name").value="";drawer();sync();status("Saved preset “"+name+"”.");}
    else status("This panel could not save the preset.",true);
  });

  /* ---------- Illustrator ---------- */
  function showSelection(data) {
    revision=data.revision || null; token=data.token || null; source=data.shapes || [];
    original=false;idleMessage=data.reason || "";
    $("source").textContent=token ? "Selection · "+source.length+" "+(source.length===1?"object":"objects") :
      data.state==="empty" ? "No selection" : "Preview unavailable";
    stage.fit();
    if (effect.id==="point") buildControls();
    renderNow();
    if (mode==="explore") breed();
    if (!$("drawer").hidden) drawer();
  }
  async function refresh(inspect=false) {
    clearTimeout(timer);
    inspectNext=inspectNext || inspect;
    if (!bridge || busy || reading || document.hidden) return;
    const stamp=epoch, deep=inspectNext;inspectNext=false;reading=true;
    let delay=450;
    try {
      const data=await host("BurgVectorHost.watch("+JSON.stringify(revision)+","+deep+")");
      if (stamp===epoch && !data.unchanged) showSelection(data);
    } catch(e) {
      delay=1500;
      if (stamp===epoch && (revision || idleMessage!==e.message)) showSelection({reason:e.message});
    } finally {
      reading=false;
      if (!busy && !document.hidden) timer=setTimeout(()=>refresh(),inspectNext ? 0 : delay);
    }
  }
  async function apply() {
    renderNow();
    if (!result || !token || busy) return;
    const args=[token,effect.name,result,$("placement").value].map(v=>
      JSON.stringify(v).replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029"));
    busy=true;epoch++;clearTimeout(timer);sync();status("Creating editable paths…");
    try {
      const data=await host("BurgVectorHost.apply("+args.join(",")+")");
      token=null;status("Created "+data.count+" vector "+(data.count===1?"object":"objects")+". The result is selected.");
    } catch(e) {status(e.message,true);}
    finally {busy=false;sync();refresh(true);}
  }

  /* ---------- Wiring ---------- */
  for (const fam of new Set(VectorCatalog.map(e=>e.family))) {
    const group=document.createElement("optgroup"); group.label=fam;
    for (const e of VectorCatalog.filter(e=>e.family===fam)) group.append(new Option(e.name,e.id));
    $("effect").append(group);
  }
  $("effect").onchange=()=>selectEffect($("effect").value);
  $("mode-tweak").onclick=()=>setMode("tweak");
  $("mode-explore").onclick=()=>setMode("explore");
  $("options").onclick=openPrefs;
  $("presets-btn").onclick=()=>toggleDrawer();
  $("vary").onclick=()=>{
    if (!result) return;
    beforeVariation.set(effect.id,{...params()});
    setParams(VectorExplore.mutate(effect,params(),VARY));
    status("Showing a variation. Presets → Before variation returns to the previous settings.");
  };
  $("zoom-in").onclick=()=>stage.zoom(1.5);
  $("zoom-out").onclick=()=>stage.zoom(1/1.5);
  $("pan").onclick=()=>{const on=$("pan").getAttribute("aria-pressed")!=="true";$("pan").setAttribute("aria-pressed",String(on));stage.setPanning(on);};
  $("pan").ondblclick=()=>stage.fit();
  $("compare").onclick=()=>{original=!original;stage.draw();sync();};
  $("save").onclick=()=>{toggleDrawer(true);$("preset-name").focus();};
  $("remove").onclick=()=>{
    if (presetName && S.removePreset(effect.id,presetName)) {status("Removed preset “"+presetName+"”.");presetName=null;}
    if (!$("drawer").hidden) drawer();
    sync();
  };
  $("reset").onclick=()=>{setParams({},"Default");status("Back to the default settings.");};
  $("help").onclick=()=>status("Drag across a control to change it; hold Shift for fine steps. Double-click to type a value. Drag the blue handles in the preview.");
  $("apply").onclick=apply;
  if (bridge) {
    $("source").textContent="Selection";
    window.addEventListener("focus",()=>refresh(true));
    document.addEventListener("visibilitychange",()=>refresh(!document.hidden));
  }

  applyPrefs();exploreBar();
  const last=prefs.restore ? S.last() : null;
  if (last) for (const e of VectorCatalog) if (last.values[e.id]) values.set(e.id,sanitize(e,last.values[e.id]));
  selectEffect(last ? last.effect : effect.id);
  if (bridge) refresh();
})();
