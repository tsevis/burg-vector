/* Controls in the KPT spirit: each pill is a slider, so click or drag along it to set its value.
   Each widget calls onInput(value, final); final is true when a drag ends or a value is typed. */
const VectorWidgets = (() => {
  const FINE=0.1;
  // Follows a mouse drag at window level. Pointer capture is unreliable in Illustrator's panel
  // runtime, and the window keeps reporting moves after the pointer leaves the element.
  function track(el,down,move,up) {
    el.addEventListener("mousedown",e=>{
      if (e.button!==0 || down(e)===false) return;
      e.preventDefault();
      const onMove=ev=>move(ev);
      const onUp=ev=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);up(ev);};
      window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);
    });
  }
  const decimals=c=>(String(c.step).split(".")[1]||"").length;
  const format=(c,v)=>Number(v).toFixed(decimals(c))+(c.unit==="°" ? "°" : c.unit ? " "+c.unit : "");
  function ticks(c) {
    const fine=c.fineMax===undefined ? Infinity : c.fineMax, coarse=c.coarseStep||1;
    const to=v=>v>fine ? (fine-c.min)/c.step+Math.round((v-fine)/coarse) : Math.round((v-c.min)/c.step);
    const from=t=>{
      const fineTicks=(fine-c.min)/c.step;
      return t>fineTicks ? fine+(t-fineTicks)*coarse : Number((c.min+t*c.step).toFixed(6));
    };
    return {to,from,count:to(c.max)};
  }
  function make(tag,cls,text) {
    const node=document.createElement(tag); if (cls) node.className=cls; if (text) node.textContent=text; return node;
  }
  function scrubber(c,value,onInput) {
    const pill=make("div","pill scrub"), label=make("span","pill-label",c.label), out=make("span","pill-value");
    const meter=make("span","meter"), fill=make("i");meter.append(fill);
    const t=ticks(c);let current=value,drag=null,lastPress=null;
    pill.tabIndex=0;pill.setAttribute("role","slider");pill.setAttribute("aria-label",c.label);
    pill.setAttribute("aria-valuemin",c.min);pill.setAttribute("aria-valuemax",c.max);
    pill.title=c.label+" — click or drag along it, Shift for fine steps, double-click to type";
    pill.append(label,out,meter);
    const show=v=>{
      current=v;out.textContent=format(c,v);
      pill.setAttribute("aria-valuenow",v);pill.setAttribute("aria-valuetext",format(c,v));
      fill.style.width=(t.count ? 100*t.to(v)/t.count : 0)+"%";
    };
    const commit=(tick,final)=>{
      const v=t.from(Math.max(0,Math.min(t.count,tick)));
      if (v!==current || final) {show(v);onInput(v,final);}
    };
    // Plain drags place the value under the pointer; Shift switches to fine steps from where it is.
    const at=e=>{
      const r=meter.getBoundingClientRect();
      return Math.round(Math.max(0,Math.min(1,(e.clientX-r.left)/Math.max(1,r.width)))*t.count);
    };
    const place=e=>{
      if (e.shiftKey!==drag.fine) drag={...drag,x:e.clientX,tick:t.to(current),fine:e.shiftKey};
      const width=Math.max(1,meter.getBoundingClientRect().width);
      commit(drag.fine ? drag.tick+Math.round((e.clientX-drag.x)/width*t.count*FINE) : at(e),false);
    };
    track(pill,e=>{
      if (e.target.tagName==="INPUT") return false;
      const recent=lastPress && Date.now()-lastPress.time<600;
      drag={x:e.clientX,tick:t.to(current),fine:e.shiftKey,before:recent ? lastPress.value : current};
      pill.classList.add("scrubbing");pill.focus({preventScroll:true});
      if (!drag.fine) place(e);
    },e=>{if (drag) place(e);},()=>{
      if (drag) {lastPress={value:drag.before,time:Date.now()};commit(t.to(current),true);}
      drag=null;pill.classList.remove("scrubbing");
    });
    pill.addEventListener("keydown",e=>{
      const step={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1}[e.key];
      if (step) {e.preventDefault();commit(t.to(current)+step*(e.shiftKey ? 10 : 1),true);}
      else if (e.key==="Home" || e.key==="End") {e.preventDefault();commit(e.key==="Home" ? 0 : t.count,true);}
      else if (e.key==="Enter") {e.preventDefault();entry();}
    });
    pill.addEventListener("dblclick",e=>{
      if (e.target.tagName==="INPUT") return;
      if (lastPress && Date.now()-lastPress.time<600 && lastPress.value!==current) commit(t.to(lastPress.value),true);
      entry();
    });
    function entry() {
      if (pill.querySelector("input")) return;
      const box=make("input","entry");box.type="number";box.min=c.min;box.max=c.max;box.step="any";box.value=current;
      out.replaceWith(box);box.focus();box.select();
      const done=keep=>{
        if (!box.isConnected) return;
        const v=Number(box.value);box.replaceWith(out);
        if (keep && box.value!=="" && Number.isFinite(v)) {
          const snapped=t.from(Math.max(0,Math.min(t.count,t.to(Math.max(c.min,Math.min(c.max,v))))));
          show(snapped);onInput(snapped,true);
        }
        pill.focus();
      };
      box.addEventListener("keydown",e=>{if (e.key==="Enter") done(true); if (e.key==="Escape") done(false); e.stopPropagation();});
      box.addEventListener("blur",()=>done(true));
    }
    show(value);
    return {el:pill,set:show};
  }
  function choice(c,value,onInput) {
    const pill=make("label","pill"), text=make("span","pill-label"), menu=document.createElement("select");
    for (const o of c.options) menu.add(new Option(o));
    menu.setAttribute("aria-label",c.label);
    const show=v=>{menu.value=v;text.textContent=v;};
    menu.onchange=()=>{show(menu.value);onInput(menu.value,true);};
    pill.append(text,make("span","pill-value","▾"),menu);show(value);
    return {el:pill,set:show};
  }
  function color(c,value,onInput) {
    const pill=make("label","pill"), swatch=make("span","swatch"), input=document.createElement("input");
    input.type="color";input.setAttribute("aria-label",c.label);
    const show=v=>{input.value=v;swatch.style.background=v;};
    input.oninput=()=>{show(input.value);onInput(input.value,false);};
    input.onchange=()=>onInput(input.value,true);
    pill.append(make("span","pill-label",c.label),swatch,input);show(value);
    return {el:pill,set:show};
  }
  // A lit sphere: drag the highlight to set an angle (0° = light from the right, Y up).
  function sphere(c,value,onInput) {
    const row=make("div","dial-row"), ball=make("div","sphere");
    const readout=scrubber(c,value,(v,final)=>{place(v);onInput(v,final);});
    ball.setAttribute("aria-hidden","true");ball.title="Drag to move the "+c.label.toLowerCase();
    function place(v) {
      const a=v*Math.PI/180;
      ball.style.setProperty("--lx",(50+34*Math.cos(a))+"%");ball.style.setProperty("--ly",(50-34*Math.sin(a))+"%");
    }
    let dragging=false, angle=value;
    const pick=e=>{
      const r=ball.getBoundingClientRect();
      angle=Math.round(Math.atan2(r.top+r.height/2-e.clientY,e.clientX-r.left-r.width/2)*180/Math.PI);
      place(angle);readout.set(angle);onInput(angle,false);
    };
    // The release can land outside the panel, so finish with the angle last shown.
    track(ball,e=>{dragging=true;pick(e);},e=>{if (dragging) pick(e);},()=>{if (dragging) {dragging=false;onInput(angle,true);}});
    row.append(ball,readout.el);place(value);
    return {el:row,set:v=>{place(v);readout.set(v);}};
  }
  function control(c,value,onInput) {
    if (c.options) return choice(c,value,onInput);
    if (c.color) return color(c,value,onInput);
    if (c.dial) return sphere(c,value,onInput);
    return scrubber(c,value,onInput);
  }
  return {control,scrubber,format,track};
})();
