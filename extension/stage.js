/* The preview well: draws source or result, on-canvas handles, zoom and the hand tool.
   `app` supplies state: effect(), params(), source(), result(), original(), set(key,value,final). */
const VectorStage = (svg,app) => {
  const G=VectorGeometry, R=VectorRender, CENTERED=["distort","flare","shatter","extrude"];
  const ZOOM_MIN=0.25, ZOOM_MAX=16;
  let drag=null,editOrigin=null,frozen=null,panning=false,panFrom=null;
  let view={zoom:1,dx:0,dy:0};

  function fitted(all) {
    const pad=Math.max(1,Math.max(all.x1-all.x0,all.y1-all.y0)*0.12);
    return [all.x0-pad,-all.y1-pad,Math.max(1,all.x1-all.x0)+2*pad,Math.max(1,all.y1-all.y0)+2*pad];
  }
  function viewBox(base) {
    const w=base[2]/view.zoom,h=base[3]/view.zoom;
    return [base[0]+(base[2]-w)/2+view.dx,base[1]+(base[3]-h)/2+view.dy,w,h];
  }
  function handles(b,v) {
    const effect=app.effect().id,list=[];
    if (app.original()) return list;
    if (effect==="warp") for (const [id,x,y] of [["tl",b.x0,b.y1],["tr",b.x1,b.y1],["bl",b.x0,b.y0],["br",b.x1,b.y0]])
      list.push([id,x+v[id+"x"]*b.w/100,y+v[id+"y"]*b.h/100]);
    if (CENTERED.includes(effect)) list.push(["center",b.x0+b.w*v.cx/100,b.y0+b.h*v.cy/100]);
    return list;
  }
  function draw() {
    const source=app.source(),result=app.result(),v=app.params();
    svg.replaceChildren();
    if (!source.length) return;
    const output=app.original() || !result ? source : result;
    const b=G.bounds(source),all=G.bounds(source.concat(result||[]),true),marks=handles(b,v);
    for (const [,x,y] of marks) {all.x0=Math.min(all.x0,x);all.x1=Math.max(all.x1,x);all.y0=Math.min(all.y0,y);all.y1=Math.max(all.y1,y);}
    if (!drag || !frozen) frozen=fitted(all);
    const box=viewBox(frozen);svg.setAttribute("viewBox",box.join(" "));
    const g=R.el("g",{transform:"scale(1,-1)"});svg.append(g);R.shapes(g,output);
    const size=Math.max(box[2]/Math.max(1,svg.clientWidth),box[3]/Math.max(1,svg.clientHeight))*4.5;
    for (const [id,x,y] of marks) {
      const ring=R.el("circle",{cx:x,cy:y,r:size,fill:"#0c1830",stroke:"#8fb2e6","stroke-width":size/2.6,cursor:"move"});
      ring.dataset.drag=id;g.append(ring);
    }
    if (!app.original() && result && app.effect().id==="point") anchors(g,source,v,size);
  }
  function anchors(g,source,v,size) {
    let contour=0;
    for (const shape of source) for (const path of shape.paths) {
      contour++;
      for (let i=0;i<path.points.length;i++) {
        const active=(!v.contour || v.contour===contour) && v.index===i+1;
        if (!active && path.points.length>180) continue;
        const q=path.points[i].slice();
        if (active && v.mode==="Move anchor") for (const j of [0,2,4]) {q[j]+=v.dx;q[j+1]+=v.dy;}
        const mark=(kind,x,y,r,fill)=>{
          const dot=R.el("circle",{cx:x,cy:y,r,fill,stroke:"#0c1830","stroke-width":size/4,cursor:"move"});
          Object.assign(dot.dataset,{drag:kind,contour:String(contour),index:String(i+1)});g.append(dot);
        };
        if (active) for (const [j,kind] of [[2,"incoming"],[4,"outgoing"]]) {
          if (v.mode==="Move "+kind+" handle") {q[j]+=v.dx;q[j+1]+=v.dy;}
          if (G.dist(q,q.slice(j,j+2))<size*0.7) continue;
          g.append(R.el("line",{x1:q[0],y1:q[1],x2:q[j],y2:q[j+1],stroke:"#c9cfd8","stroke-width":size/5}));
          mark(kind,q[j],q[j+1],size*0.75,"#8fb2e6");
        }
        mark("anchor",q[0],q[1],size*(active ? 1 : 0.62),active ? "#f4f6f9" : "#8e97a4");
      }
    }
  }
  const toWorld=e=>new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  VectorWidgets.track(svg,e=>{
    if (panning && !e.target.dataset.drag) {panFrom={x:e.clientX,y:e.clientY,dx:view.dx,dy:view.dy};return;}
    if (!e.target.dataset.drag) return false;
    drag=e.target.dataset.drag;editOrigin=null;
    if (e.target.dataset.contour) {
      const contour=Number(e.target.dataset.contour),i=Number(e.target.dataset.index),v=app.params();
      const q=app.source().flatMap(s=>s.paths)[contour-1].points[i-1];
      const j=drag==="anchor" ? 0 : (drag==="incoming" ? 2 : 4);
      const mode=drag==="anchor" ? "Move anchor" : "Move "+drag+" handle";
      if (v.mode!==mode || v.index!==i || (v.contour && v.contour!==contour)) {app.set("dx",0);app.set("dy",0);}
      app.set("contour",contour);app.set("index",i);app.set("mode",mode,true);
      editOrigin=[q[j],q[j+1]];
    }
  },e=>{
    if (panFrom) {
      const scale=Number(svg.getAttribute("viewBox").split(" ")[2])/Math.max(1,svg.clientWidth);
      view={...view,dx:panFrom.dx-(e.clientX-panFrom.x)*scale,dy:panFrom.dy-(e.clientY-panFrom.y)*scale};
      draw();return;
    }
    if (!drag) return;
    const pos=toWorld(e),b=G.bounds(app.source());
    if (editOrigin) {app.set("dx",pos.x-editOrigin[0]);app.set("dy",-pos.y-editOrigin[1]);}
    else if (drag==="center") {app.set("cx",100*(pos.x-b.x0)/(b.w||1));app.set("cy",100*(-pos.y-b.y0)/(b.h||1));}
    else {
      app.set(drag+"x",100*(pos.x-(drag[1]==="l" ? b.x0 : b.x1))/(b.w||1));
      app.set(drag+"y",100*(-pos.y-(drag[0]==="t" ? b.y1 : b.y0))/(b.h||1));
    }
  },()=>{
    const was=drag;drag=null;editOrigin=null;panFrom=null;
    if (was) app.set(null,null,true);
  });
  return {
    draw,
    zoom(factor) {view={...view,zoom:Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,view.zoom*factor))};draw();},
    fit() {view={zoom:1,dx:0,dy:0};frozen=null;draw();},
    setPanning(on) {panning=on;svg.classList.toggle("panning",on);},
    dragging:()=>!!drag,
  };
};
