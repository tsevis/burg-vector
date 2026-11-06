(() => {
  "use strict";
  const $=id=>document.getElementById(id), G=VectorGeometry;
  const svgNS="http://www.w3.org/2000/svg";
  const svg=(name,attrs)=>{const el=document.createElementNS(svgNS,name);
    for (const [key,val] of Object.entries(attrs)) el.setAttribute(key,val); return el;};
  const option=(text,value=text)=>new Option(text,value);
  const values=new Map(), controls=new Map(), beforeVariation=new Map();
  const bridge=window.__adobe_cep__;
  let token=null,busy=false,result=null,original=false,frame=0;
  let effect=VectorCatalog[0],source=bridge ? [] : sample(),drag=null,stageBounds=null;
  let revision=null,reading=false,inspectNext=false,timer=0,epoch=0;
  let idleMessage="Looking for selected artwork…";
  let editOrigin=null;
  const defaults=()=>Object.fromEntries(effect.controls.map(c=>[c.key,c.value]));
  const params=()=>values.get(effect.id);
  const status=(msg,error=false)=>{$("status").textContent=msg;$("status").dataset.error=error;};
  const key=()=>"vector-effects.preset."+effect.id;
  function saved() {try {return JSON.parse(localStorage.getItem(key()));} catch (_) {return null;}}
  function sample() {
    const n=48,points=[];
    // A lobed seal with an open counter makes curvature and compound holes visible.
    for (let i=0;i<n;i++) {
      const a=i*2*Math.PI/n,r=50+8*Math.cos(8*a),dr=-64*Math.sin(8*a);
      const x=r*Math.cos(a),y=r*Math.sin(a),k=2*Math.PI/(n*3);
      const dx=k*(dr*Math.cos(a)-r*Math.sin(a)),dy=k*(dr*Math.sin(a)+r*Math.cos(a));
      points.push([x,y,x-dx,y-dy,x+dx,y+dy]);
    }
    return [{paths:[{closed:true,points},G.circle(0,0,17)],fill:[246,113,71],stroke:null,width:0,opacity:100,evenodd:true}];
  }
  function host(script) {
    return new Promise((resolve,reject)=>{
      bridge.evalScript(script,text=>{
        try {const data=JSON.parse(text); if (data.error) throw Error(data.error);resolve(data);}
        catch(e){reject(Error(text==="EvalScript error." ? "Illustrator could not load the panel bridge. Reopen the panel." : e.message));}
      });
    });
  }
  function sync() {
    $("apply").disabled=busy || !token || !result;
    $("compare").disabled=!source.length;
    $("effect").disabled=busy;
    $("vary").disabled=busy || !result;
  }
  function setParams(data) {
    values.set(effect.id,{...defaults(),...data});
    buildControls(); renderNow();
  }
  function presets(selected="Default") {
    const menu=$("preset");menu.replaceChildren(option("Default"),option(effect.preset[0]));
    if (saved()) menu.add(option("My preset"));
    if (beforeVariation.has(effect.id)) menu.add(option("Before variation"));
    const custom=option("Custom"); custom.disabled=true;menu.add(custom);
    menu.value=selected;
  }
  function selectEffect(id) {
    effect=VectorCatalog.find(e=>e.id===id);
    if (!values.has(id)) values.set(id,defaults());
    original=false;
    presets(JSON.stringify(params())===JSON.stringify(defaults()) ? "Default" : "Custom");
    buildControls(); renderNow();
  }
  function setValue(c,value) {
    params()[c.key]=value;$("preset").value="Custom";original=false;schedule();
  }
  function vary() {
    const previous={...params()}, next={...previous};
    const candidates=[...controls.keys()].filter(key=>
      key!=="contour" && (key!=="index" || !previous.mode.startsWith("Move")));
    for (let i=0;i<2 && candidates.length;i++) {
      const key=candidates.splice(Math.floor(Math.random()*candidates.length),1)[0];
      const [input]=controls.get(key), min=Number(input.min), max=Number(input.max), step=Number(input.step);
      const steps=Math.round((max-min)/step), current=Math.round((previous[key]-min)/step);
      if (!steps) continue;
      const distance=Math.max(1,Math.round(steps*(0.035+Math.random()*0.065)));
      const towardMax=current===0 || (current<steps && Math.random()<0.5);
      const moved=Math.max(0,Math.min(steps,current+(towardMax ? distance : -distance)));
      next[key]=Number((min+moved*step).toFixed(4));
    }
    const wasOriginal=original;
    original=false;
    setParams(next);
    if (!result || Object.keys(next).every(key=>next[key]===previous[key])) {
      original=wasOriginal;
      setParams(previous);
      status("Try another variation or adjust a control.");
      return;
    }
    beforeVariation.set(effect.id,previous);presets("Custom");
  }
  function buildControls() {
    const container=$("controls");container.replaceChildren();controls.clear();
    for (const c of effect.controls) {
      if (effect.id==="point" && ["dx","dy"].includes(c.key) && !params().mode.startsWith("Move")) continue;
      const row=document.createElement("div");row.className="control";
      const title=document.createElement("div");title.className="control-title";
      const label=document.createElement("label");label.htmlFor="control-"+c.key;
      label.textContent=c.label+(c.unit ? " ("+c.unit+")" : ""); title.append(label);row.append(title);
      if (c.options) {
        const menu=document.createElement("select");menu.id=label.htmlFor;
        for (const o of c.options) menu.add(option(o));
        menu.value=params()[c.key];
        menu.onchange=()=>{setValue(c,menu.value);if(effect.id==="point") buildControls();};
        row.append(menu);
      } else {
        const num=document.createElement("input"),slider=document.createElement("input");
        num.type="number";num.id=label.htmlFor;
        slider.type="range";slider.setAttribute("aria-label",c.label);
        const contours=source.flatMap(s=>s.paths);
        let max=c.max;
        if (contours.length && effect.id==="point" && c.key==="index") {
          const target=contours[params().contour-1];
          max=Math.min(c.max,target ? target.points.length : Math.max(...contours.map(p=>p.points.length)));
        }
        if (contours.length && effect.id==="point" && c.key==="contour") max=Math.min(c.max,contours.length);
        params()[c.key]=Math.min(params()[c.key],max);
        for (const el of [num,slider]) {el.min=c.min;el.max=max;el.step=c.step;el.value=params()[c.key];}
        slider.oninput=()=>{num.value=slider.value;setValue(c,Number(slider.value));};
        num.onchange=()=>{
          if (!num.value || !num.validity.valid) {num.value=params()[c.key];return;}
          slider.value=num.value;setValue(c,Number(slider.value));
        };
        controls.set(c.key,[num,slider]);title.append(num);row.append(slider);
      }
      container.append(row);
    }
  }
  function pathData(p) {
    const pts=p.points;let d="M"+pts[0][0]+" "+pts[0][1];
    for (let i=0;i<pts.length-(p.closed ? 0 : 1);i++) {
      const a=pts[i],b=pts[(i+1)%pts.length];
      d+="C"+[a[4],a[5],b[2],b[3],b[0],b[1]].join(" ");
    }
    return d+(p.closed ? "Z" : "");
  }
  const paint=c=>c ? "rgb("+c.slice(0,3).map(Math.round).join(",")+")" : "none";
  function draw() {
    const view=$("preview"),output=original || !result ? source : result;
    $("prompt").hidden=!!source.length;
    $("compare").textContent=original ? "Show effect" : "Show original";
    $("compare").setAttribute("aria-pressed",String(original));
    if (!source.length) {view.replaceChildren();$("prompt").textContent=idleMessage;return;}
    const b=G.bounds(source), all=G.bounds(source.concat(result||[]),true);
    const corners={tl:[b.x0,b.y1],tr:[b.x1,b.y1],bl:[b.x0,b.y0],br:[b.x1,b.y0]};
    const handles=[];
    if (!original && effect.id==="warp") {
      for (const [id,[x,y]] of Object.entries(corners)) {
        const hx=x+params()[id+"x"]*b.w/100,hy=y+params()[id+"y"]*b.h/100;
        handles.push([id,hx,hy]);all.x0=Math.min(all.x0,hx);all.x1=Math.max(all.x1,hx);
        all.y0=Math.min(all.y0,hy);all.y1=Math.max(all.y1,hy);
      }
    }
    if (!original && ["distort","flare","shatter"].includes(effect.id))
      handles.push(["center",b.x0+b.w*params().cx/100,b.y0+b.h*params().cy/100]);
    const padding=Math.max(1,Math.max(all.x1-all.x0,all.y1-all.y0)*0.12);
    if (!drag || !stageBounds) stageBounds=[all.x0-padding,-all.y1-padding,
      Math.max(1,all.x1-all.x0)+2*padding,Math.max(1,all.y1-all.y0)+2*padding];
    view.setAttribute("viewBox",stageBounds.join(" "));view.replaceChildren();
    const g=svg("g",{transform:"scale(1,-1)"});view.append(g);
    for (const s of output) {
      const el=svg("path",{d:s.paths.map(pathData).join(" "),fill:paint(s.fill),stroke:paint(s.stroke),
        "stroke-width":s.width||0,"fill-rule":s.evenodd ? "evenodd" : "nonzero",
        "stroke-linecap":s.cap||"butt","stroke-linejoin":s.join||"miter",
        "stroke-miterlimit":s.miter||4,opacity:s.opacity/100});
      if (s.dash && s.dash.length) {el.setAttribute("stroke-dasharray",s.dash.join(" "));el.setAttribute("stroke-dashoffset",s.dashOffset||0);}
      g.append(el);
    }
    const handleSize=Math.max(stageBounds[2]/Math.max(1,view.clientWidth),stageBounds[3]/Math.max(1,view.clientHeight))*4;
    for (const [id,x,y] of handles) {
      const dot=svg("circle",{cx:x,cy:y,r:handleSize,fill:"#202022",stroke:"#fff2dc","stroke-width":handleSize/3});
      dot.dataset.drag=id;dot.setAttribute("cursor","move");g.append(dot);
    }
    if (!original && result && effect.id==="point") {
      let contour=0;
      for (const shape of source) for (const path of shape.paths) {
        contour++;
        for (let i=0;i<path.points.length;i++) {
          const active=(!params().contour || params().contour===contour) && params().index===i+1;
          if (!active && path.points.length>180) continue;
          const q=path.points[i].slice();
          if (active && params().mode==="Move anchor") {
            for (const j of [0,2,4]) {q[j]+=params().dx;q[j+1]+=params().dy;}
          }
          const mark=(kind,x,y,size,fill)=>{
            const dot=svg("circle",{cx:x,cy:y,r:size,fill,stroke:"#202022","stroke-width":handleSize/4,cursor:"move"});
            dot.dataset.drag=kind;dot.dataset.contour=String(contour);dot.dataset.index=String(i+1);g.append(dot);
          };
          if (active) for (const [j,kind] of [[2,"incoming"],[4,"outgoing"]]) {
            if (params().mode==="Move "+kind+" handle") {q[j]+=params().dx;q[j+1]+=params().dy;}
            if (G.dist(q,q.slice(j,j+2))<handleSize*0.7) continue;
            g.append(svg("line",{x1:q[0],y1:q[1],x2:q[j],y2:q[j+1],stroke:"#eee2d1","stroke-width":handleSize/5}));
            mark(kind,q[j],q[j+1],handleSize*0.75,"#f5b491");
          }
          mark("anchor",q[0],q[1],handleSize*(active ? 1 : 0.62),active ? "#fff2dc" : "#b1a699");
        }
      }
    }
  }
  function renderNow() {
    if (frame) {cancelAnimationFrame(frame);frame=0;}
    if (!source.length) {result=null;status("");draw();sync();return;}
    try {
      result=VectorEffects.run(effect.id,source,params());
      const anchors=result.reduce((n,s)=>n+s.paths.reduce((sum,p)=>sum+p.points.length,0),0);
      if (token) status(result.length+" vector "+(result.length===1?"object":"objects")+" · "+anchors+" anchors");
      else if (!bridge) status("Sample preview. Open the panel in Illustrator to use your artwork.");
    } catch (e) {result=null;status(e.message,true);}
    draw();sync();
  }
  function schedule() {
    if (!frame) frame=requestAnimationFrame(()=>{frame=0;renderNow();});
  }
  function showSelection(data) {
    revision=data.revision || null; token=data.token || null; source=data.shapes || [];
    drag=editOrigin=stageBounds=null;original=false;
    idleMessage=data.reason || "";
    $("source").textContent=token ? "Selection · "+source.length+" "+(source.length===1?"object":"objects") :
      data.state==="empty" ? "No selection" : "Preview unavailable";
    if (effect.id==="point") buildControls();
    renderNow();
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
  const view=$("preview");
  view.addEventListener("pointerdown",e=>{
    if (!e.target.dataset.drag) return;
    drag=e.target.dataset.drag;editOrigin=null;
    if (e.target.dataset.contour) {
      const contour=Number(e.target.dataset.contour),i=Number(e.target.dataset.index);
      const q=source.flatMap(s=>s.paths)[contour-1].points[i-1];
      const j=drag==="anchor" ? 0 : (drag==="incoming" ? 2 : 4);
      const mode=drag==="anchor" ? "Move anchor" : "Move "+drag+" handle";
      if (params().mode!==mode || params().index!==i || (params().contour && params().contour!==contour)) {
        params().dx=0;params().dy=0;
      }
      Object.assign(params(),{contour,index:i,mode});
      editOrigin=[q[j],q[j+1]];buildControls();schedule();
    }
    view.setPointerCapture(e.pointerId);
  });
  view.addEventListener("pointermove",e=>{
    if (!drag) return;
    const pos=new DOMPoint(e.clientX,e.clientY).matrixTransform(view.getScreenCTM().inverse()),b=G.bounds(source);
    const set=(key,n)=>{
      const c=effect.controls.find(p=>p.key===key),val=Math.max(c.min,Math.min(c.max,Math.round(n)));
      params()[key]=val;for (const el of controls.get(key)) el.value=val;
    };
    if (editOrigin) {
      set("dx",pos.x-editOrigin[0]);set("dy",-pos.y-editOrigin[1]);
    } else if (drag==="center") {
      set("cx",100*(pos.x-b.x0)/(b.w||1));set("cy",100*(-pos.y-b.y0)/(b.h||1));
    } else {
      set(drag+"x",100*(pos.x-(drag[1]==="l" ? b.x0 : b.x1))/(b.w||1));
      set(drag+"y",100*(-pos.y-(drag[0]==="t" ? b.y1 : b.y0))/(b.h||1));
    }
    $("preset").value="Custom";schedule();
  });
  view.addEventListener("lostpointercapture",()=>{drag=null;editOrigin=null;schedule();});
  for (const family of new Set(VectorCatalog.map(e=>e.family))) {
    const group=document.createElement("optgroup"); group.label=family;
    for (const e of VectorCatalog.filter(e=>e.family===family)) group.append(option(e.name,e.id));
    $("effect").append(group);
  }
  $("effect").onchange=()=>selectEffect($("effect").value);
  $("preset").onchange=()=>{
    const selection=$("preset").value;
    const choices={"Default":{},"My preset":saved(),"Before variation":beforeVariation.get(effect.id)};
    original=false;setParams(choices[selection] || effect.preset[1]);
  };
  $("vary").onclick=vary;
  $("save").onclick=()=>{
    try {localStorage.setItem(key(),JSON.stringify(params()));presets("My preset");status("Saved settings for "+effect.name+".");}
    catch (_) {status("This panel could not save the preset.",true);}
  };
  $("compare").onclick=()=>{original=!original;draw();};
  $("apply").onclick=apply;
  if (bridge) {
    $("source").textContent="Selection";
    window.addEventListener("focus",()=>refresh(true));
    document.addEventListener("visibilitychange",()=>refresh(!document.hidden));
  }
  selectEffect(effect.id);if (bridge) refresh();
})();
