/* Controls in the KPT spirit: drag across a pill to change its value. Each widget calls
   onInput(value, final); final is true when a drag ends or a value is typed. */
const VectorWidgets = (() => {
  const DRAG_SPAN=260, FINE=0.1;
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
    const t=ticks(c);let current=value,drag=null;
    pill.tabIndex=0;pill.setAttribute("role","slider");pill.setAttribute("aria-label",c.label);
    pill.setAttribute("aria-valuemin",c.min);pill.setAttribute("aria-valuemax",c.max);
    pill.title=c.label+" — drag across, or double-click to type";
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
    pill.addEventListener("pointerdown",e=>{
      if (e.button!==0 || e.target.tagName==="INPUT") return;
      drag={x:e.clientX,tick:t.to(current),moved:false,fine:e.shiftKey};pill.setPointerCapture(e.pointerId);
    });
    pill.addEventListener("pointermove",e=>{
      if (!drag) return;
      // Pressing or releasing Shift mid-drag continues from the current value.
      if (e.shiftKey!==drag.fine) drag={...drag,x:e.clientX,tick:t.to(current),fine:e.shiftKey};
      const dx=e.clientX-drag.x;
      if (Math.abs(dx)>2 && !drag.moved) {drag.moved=true;pill.classList.add("scrubbing");}
      if (drag.moved) commit(drag.tick+Math.round(dx/Math.max(0.35,DRAG_SPAN/Math.max(1,t.count))*(e.shiftKey ? FINE : 1)),false);
    });
    const end=()=>{
      if (drag && drag.moved) commit(t.to(current),true);
      drag=null;pill.classList.remove("scrubbing");
    };
    pill.addEventListener("lostpointercapture",end);
    pill.addEventListener("keydown",e=>{
      const step={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1}[e.key];
      if (step) {e.preventDefault();commit(t.to(current)+step*(e.shiftKey ? 10 : 1),true);}
      else if (e.key==="Home" || e.key==="End") {e.preventDefault();commit(e.key==="Home" ? 0 : t.count,true);}
      else if (e.key==="Enter") {e.preventDefault();entry();}
    });
    pill.addEventListener("dblclick",entry);
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
    ball.addEventListener("pointerdown",e=>{dragging=true;ball.setPointerCapture(e.pointerId);pick(e);});
    ball.addEventListener("pointermove",e=>{if (dragging) pick(e);});
    // Release events can carry no coordinates, so finish with the angle last shown.
    ball.addEventListener("lostpointercapture",()=>{if (dragging) {dragging=false;onInput(angle,true);}});
    row.append(ball,readout.el);place(value);
    return {el:row,set:v=>{place(v);readout.set(v);}};
  }
  function control(c,value,onInput) {
    if (c.options) return choice(c,value,onInput);
    if (c.color) return color(c,value,onInput);
    if (c.dial) return sphere(c,value,onInput);
    return scrubber(c,value,onInput);
  }
  return {control,scrubber,format};
})();
