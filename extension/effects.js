const VectorEffects = (() => {
  const G=VectorGeometry, P=VectorPathEffects;
  const L=VectorLight;
  // Warp Frame envelopes, as displacements from the original position.
  function warpShape(v,b) {
    const k=v.bend/100,w=b.w,h=b.h,s=Math.sin,PI=Math.PI;
    switch (v.shape) {
      case "Arc": return (x,y,u)=>[0,h*k*0.5*s(PI*u)];
      case "Bulge": return (x,y,u,t)=>[0,h*k*0.5*s(PI*u)*(2*t-1)];
      case "Wave": return (x,y,u)=>[0,h*k*0.25*s(2*PI*u)];
      case "Flag": return (x,y,u,t)=>[w*k*0.04*s(2*PI*t),h*k*0.3*u*s(3*PI*u)];
      case "Twist": return (x,y,u,t)=>{
        const a=k*PI/2*(2*t-1),px=x-b.cx,py=y-b.cy;
        return [px*Math.cos(a)-py*Math.sin(a)-px,px*Math.sin(a)+py*Math.cos(a)-py];
      };
      default: return null;
    }
  }
  function deform(shapes,v,b,lens) {
    const w=Math.max(1e-6,b.w),h=Math.max(1e-6,b.h),size=Math.max(w,h);
    const cx=b.x0+w*(v.cx||0)/100,cy=b.y0+h*(v.cy||0)/100,r=size*(v.radius||100)/100;
    const phase=lens ? G.random(v.seed)()*2*Math.PI : 0,bend=lens ? null : warpShape(v,b);
    // Edge hardness flattens the falloff; 0 keeps the original quadratic.
    const hard=Math.max(0.1,2*(1-v.hardness/100));
    function map(x,y) {
      if (lens) {
        let dx=x-cx,dy=y-cy;
        const t=Math.hypot(dx,dy)/r;
        if (t>=1) return [x,y];
        const amount=v.hardness ? v.strength/100*Math.pow(1-t,hard) : v.strength/100*(1-t)*(1-t);
        if (v.lens==="Swirl" || v.lens==="Rotate") {
          const a=(v.lens==="Swirl" ? amount*1.6 : v.strength/100*(1-t*t*t*t))*Math.PI;
          return [cx+dx*Math.cos(a)-dy*Math.sin(a),cy+dx*Math.sin(a)+dy*Math.cos(a)];
        }
        if (v.lens==="Ripple" || v.lens==="Wobble") {
          const wave=v.lens==="Ripple" ? t*Math.PI*v.frequency : Math.atan2(dy,dx)*v.frequency;
          const k=1+Math.sin(wave+phase)*amount*0.35;
          return [cx+dx*k,cy+dy*k];
        }
        if (["Zig","Zag","ZigZag"].includes(v.lens)) {
          const wave=d=>Math.sin(d/r*Math.PI*v.frequency)*r*amount*0.45;
          return [x+(v.lens==="Zag" ? 0 : wave(dy)),y+(v.lens==="Zig" ? 0 : wave(dx))];
        }
        const factor=v.lens==="Magnify" ? 1+v.strength/100*(1-t*t)*(1-t*t)*1.3 :
          Math.exp((v.lens==="Spherize" ? 1 : -1)*amount*1.5);
        return [cx+factor*dx,cy+factor*dy];
      }
      const u=(x-b.x0)/w,t=(y-b.y0)/h;
      const blend=axis=>(1-u)*(1-t)*v["bl"+axis]+u*(1-t)*v["br"+axis]+
        (1-u)*t*v["tl"+axis]+u*t*v["tr"+axis];
      const bowX=4*t*(1-t)*((1-u)*-v.left+u*v.right);
      const bowY=4*u*(1-u)*((1-t)*-v.bottom+t*v.top);
      const out=[x+w*(blend("x")+bowX)/100,y+h*(blend("y")+bowY)/100];
      if (!bend) return out;
      const [sx,sy]=bend(x,y,u,t);
      return [out[0]+sx,out[1]+sy];
    }
    return shapes.map(s=>({...s,paths:s.paths.map(p=>{
      const divided=G.splitPath(p,c=>G.dist(c[0],c[1])+G.dist(c[1],c[2])+G.dist(c[2],c[3])>
        (lens ? Math.min(r/4,size/10) : size/5),7);
      return G.mapPath(divided,map);
    })}));
  }
  const effects={extrude:VectorExtrude.extrude,shatter:P.shatter,inset:P.inset,sketch:VectorSketch.sketch,
    shadow:L.shadow,neon:L.neon,flare:L.flare,emboss:L.emboss,color:VectorPaint.shift,
    warp:(s,v,b)=>deform(s,v,b,false),distort:(s,v,b)=>deform(s,v,b,true),
    point:(s,v)=>{
      let contour=0,edited=false;
      const out=s.map(p=>({...p,paths:p.paths.map(path=>{
        contour++;
        if (v.contour && v.contour!==contour) return path;
        if (v.index>path.points.length-(v.mode==="Subdivide" && !path.closed ? 1 : 0)) return path;
        edited=true;return P.point(path,v);
      })}));
      if (!edited) throw Error("Choose an anchor that exists on the selected contour.");
      return out;
    },
    simplify:(s,v)=>s.map(p=>({...p,paths:p.paths.map(path=>P.simplify(path,v.error,v.corners))}))};
  function run(id,shapes,values) {
    if (!shapes.length) throw Error("Select at least one path.");
    const controls=VectorCatalog.find(e=>e.id===id).controls,v={};
    for (const c of controls) {
      const val=values[c.key]===undefined ? c.value : values[c.key];
      if (c.options) {
        if (!c.options.includes(val)) throw Error("Unknown "+c.label+".");
      } else if (c.color) {
        if (!/^#[0-9a-f]{6}$/i.test(val)) throw Error("Check "+c.label+" colour.");
      } else if (!Number.isFinite(val) || val<c.min || val>c.max) throw Error("Check "+c.label+".");
      v[c.key]=val;
    }
    const out=effects[id](shapes,v,G.bounds(shapes));
    let anchors=0;
    for (const s of out) for (const p of s.paths) {
      // Illustrator accepts 32,000 anchors per path; host.jsx enforces the same limit.
      if (p.points.length>32000) throw Error("A result path exceeds 32,000 anchors, Illustrator's limit. Reduce detail or simplify the source.");
      anchors+=p.points.length;
    }
    if (out.length>1800 || anchors>40000) throw Error("Result exceeds 40,000 anchors or 1,800 objects. Reduce detail or select less artwork.");
    if (!anchors) throw Error("The settings produce an empty result.");
    return out;
  }
  return {run};
})();
