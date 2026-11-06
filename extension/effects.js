const VectorEffects = (() => {
  const G=VectorGeometry, P=VectorPathEffects, rad=Math.PI/180;
  const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
  const ink=[20,19,28],white=[255,252,246];
  const tint=(color,target,t)=>G.mix(color.slice(0,3),target,t).map(Math.round);
  const base=s=>s.fill || s.stroke || ink;
  const mapShape=(s,fn)=>({...s,paths:s.paths.map(p=>G.mapPath(p,fn))});
  const flatShape=(paths,fill,opacity=100)=>({paths,fill,stroke:null,width:0,opacity,evenodd:false});
  function changeInks(s,fn) {
    return {...s,fill:s.fill && fn(s.fill),stroke:s.stroke && fn(s.stroke)};
  }
  function hue(color,v) {
    const luminosity=0.2126*color[0]+0.7152*color[1]+0.0722*color[2];
    const [r,g,b]=color.slice(0,3).map(channel=>{
      let x=channel+(luminosity-channel)*v.gray/100;
      x+=(255-2*x)*v.invert/100;
      return clamp((x/255-0.5)*Math.pow(3,v.contrast/100)+0.5,0,1);
    });
    const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo;
    let l=(hi+lo)/2,h=0,s=d ? d/(1-Math.abs(2*l-1)) : 0;
    if (d) {
      if (hi===r) h=(g-b)/d;
      else if (hi===g) h=2+(b-r)/d;
      else h=4+(r-g)/d;
    }
    h=((h/6+v.hue/360)%1+1)%1;
    s=clamp(s+v.sat/100,0,1); l=clamp(l+v.lum/100,0,1);
    const a=s*Math.min(l,1-l);
    return [0,8,4].map(n=>{
      const k=(n+h*12)%12;
      return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));
    });
  }
  function extrude(shapes,v,b) {
    const cx=Math.cos(v.rx*rad),sx=Math.sin(v.rx*rad),cy=Math.cos(v.ry*rad),sy=Math.sin(v.ry*rad);
    const cz=Math.cos(v.rz*rad),sz=Math.sin(v.rz*rad),result=[];
    const lx=Math.cos(v.light*rad),ly=Math.sin(v.light*rad);
    function project(x,y,z) {
      const u=x-b.cx,w=y-b.cy,k=w*sx+z*cx;
      const xx=u*cy+k*sy,yy=w*cx-z*sx;
      const depth=-u*sy+k*cy;
      const camera=Math.max(1,b.w,b.h,v.depth)*2;
      const scale=camera/(camera-depth*v.perspective/100);
      return [b.cx+scale*(xx*cz-yy*sz),b.cy+scale*(xx*sz+yy*cz),depth];
    }
    for (const s of shapes) {
      if (!s.fill || s.paths.some(p=>!p.closed)) throw Error("3D Transform needs closed, filled paths. Outline strokes or type first.");
      const near=cx*cy>=0 ? 0 : -v.depth,far=-v.depth-near;
      const nearFaceSource=v.perspective ? {...s,paths:s.paths.map(p=>G.splitPath(p,c=>G.dist(c[0],c[3])>Math.max(1,b.w,b.h)/5,4))} : s;
      const face=z=>mapShape(nearFaceSource,(x,y)=>project(x,y,z).slice(0,2));
      if (v.depth===0) {result.push(face(0));continue;}
      result.push(changeInks(face(far),c=>tint(c,ink,0.45)));
      const walls=[];
      for (const p of s.paths) {
        const ring=G.flatten(p,0.45);
        for (let i=0;i<ring.length;i++) {
          const a=ring[i],q=ring[(i+1)%ring.length];
          const quad=[project(...a,far),project(...q,far),project(...q,near),project(...a,near)];
          const edgeX=quad[1][0]-quad[0][0],edgeY=quad[1][1]-quad[0][1],length=Math.hypot(edgeX,edgeY);
          if (length<0.0001) continue;
          // Pick the screen normal pointing toward the outward extrusion silhouette.
          const extX=quad[3][0]-quad[0][0],extY=quad[3][1]-quad[0][1];
          const sign=edgeY*extX-edgeX*extY>0 ? -1 : 1;
          const light=sign*(edgeY*lx-edgeX*ly)/length;
          const color=tint(base(s),ink,clamp(0.38-0.26*light,0.06,0.74));
          walls.push({z:quad.reduce((acc,p)=>acc+p[2],0)/4,
            shape:flatShape([G.polygon(quad.map(G.xy))],color,s.opacity)});
        }
      }
      walls.sort((a,b)=>a.z-b.z);
      for (const wall of walls) result.push(wall.shape);
      result.push(face(near));
    }
    return result;
  }
  function deform(shapes,v,b,lens) {
    const w=Math.max(1e-6,b.w),h=Math.max(1e-6,b.h),size=Math.max(w,h);
    const cx=b.x0+w*(v.cx||0)/100,cy=b.y0+h*(v.cy||0)/100,r=size*(v.radius||100)/100;
    function map(x,y) {
      if (lens) {
        let dx=x-cx,dy=y-cy;
        const t=Math.hypot(dx,dy)/r;
        if (t>=1) return [x,y];
        const amount=v.strength/100*(1-t)*(1-t);
        if (v.lens==="Swirl" || v.lens==="Rotate") {
          const a=(v.lens==="Swirl" ? amount*1.6 : v.strength/100*(1-t*t*t*t))*Math.PI;
          return [cx+dx*Math.cos(a)-dy*Math.sin(a),cy+dx*Math.sin(a)+dy*Math.cos(a)];
        }
        if (["Zig","Zag","ZigZag"].includes(v.lens)) {
          const wave=d=>Math.sin(d/r*Math.PI*3)*r*amount*0.45;
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
      return [x+w*(blend("x")+bowX)/100,y+h*(blend("y")+bowY)/100];
    }
    return shapes.map(s=>({...s,paths:s.paths.map(p=>{
      const divided=G.splitPath(p,c=>G.dist(c[0],c[1])+G.dist(c[1],c[2])+G.dist(c[2],c[3])>
        (lens ? Math.min(r/4,size/10) : size/5),7);
      return G.mapPath(divided,map);
    })}));
  }
  function shadow(shapes,v,b) {
    const result=[];
    for (let i=v.steps;i>=1;i--) {
      const t=i/v.steps,k=1+(v.scale/100-1)*t,a=v.spin*t*rad;
      const dx=v.length*t*Math.cos(v.angle*rad),dy=v.length*t*Math.sin(v.angle*rad);
      for (const s of shapes) {
        const copy=mapShape(s,(x,y)=>[b.cx+dx+k*((x-b.cx)*Math.cos(a)-(y-b.cy)*Math.sin(a)),
          b.cy+dy+k*((x-b.cx)*Math.sin(a)+(y-b.cy)*Math.cos(a))]);
        const shaded=changeInks(copy,c=>tint(c,ink,0.72));
        shaded.opacity=s.opacity*(0.7+(v.fade/100-0.7)*t);
        result.push(shaded);
      }
    }
    return result.concat(shapes);
  }
  function sketch(shapes,v,b) {
    const rand=G.random(v.seed),result=[];
    for (const s of shapes) {
      if (s.fill) result.push({...s,stroke:null});
      const paths=s.paths.map(p=>G.splitPath(p,c=>G.dist(c[0],c[3])>Math.max(7,Math.max(b.w,b.h)/18),5));
      for (let j=0;j<v.passes;j++) {
        const jitter=()=>v.rough*(2*rand()-1);
        const traced=paths.map(p=>({closed:p.closed,points:p.points.map(q=>{
          const x=jitter(),y=jitter();
          return [q[0]+x,q[1]+y,q[2]+x+jitter()/2,q[3]+y+jitter()/2,q[4]+x+jitter()/2,q[5]+y+jitter()/2];
        })}));
        result.push({...s,paths:traced,fill:null,stroke:tint(s.stroke||base(s),ink,0.65),width:v.width,
          opacity:s.opacity*(j===0 ? 0.85 : 0.5),cap:"round",join:"round",dash:[]});
      }
    }
    return result;
  }
  function emboss(shapes,v) {
    const dx=v.depth*Math.cos(v.light*rad),dy=v.depth*Math.sin(v.light*rad),out=[];
    for (const s of shapes) {
      out.push(changeInks(mapShape(s,(x,y)=>[x-dx,y-dy]),c=>tint(c,ink,v.contrast/100)));
      out.push(changeInks(mapShape(s,(x,y)=>[x+dx,y+dy]),c=>tint(c,white,v.contrast/100)),s);
    }
    return out;
  }
  function neon(shapes,v) {
    const out=[];
    for (const s of shapes) {
      if (s.fill) out.push({...s,stroke:null});
      const c=s.stroke||base(s);
      const band=(width,stroke,opacity)=>({...s,fill:null,stroke,width,opacity:s.opacity*Math.min(1,opacity),
        cap:"round",join:"round",dash:[]});
      for (let i=v.bands;i>0;i--) {
        const t=i/v.bands;
        out.push(band(v.width*(0.35+1.65*t),c,v.glow/100*(1.1-0.65*t)));
      }
      out.push(band(v.width*0.35,tint(c,white,0.65),1),band(v.width*0.13,white,1));
    }
    return out;
  }
  function flare(shapes,v,b) {
    const out=shapes.slice(),cx=b.x0+b.w*v.cx/100,cy=b.y0+b.h*v.cy/100;
    const size=Math.max(1,Math.max(b.w,b.h)/2),halo=size*v.halo/100;
    const color=tint(base(shapes[shapes.length-1]),[255,195,86],0.7);
    for (let i=10;i>=1;i--) out.push(flatShape([G.circle(cx,cy,halo*i/10)],color,4+(10-i)*1.2));
    for (let i=0;i<v.rays;i++) {
      const a=(v.angle+i*360/v.rays)*rad,ux=Math.cos(a),uy=Math.sin(a);
      const len=size*v.radius/100*(i%2 ? 0.6 : 1),half=halo*0.15;
      out.push(flatShape([G.polygon([[cx-uy*half,cy+ux*half],[cx+ux*len,cy+uy*len],
        [cx+uy*half,cy-ux*half]])],tint(color,white,0.55),80));
    }
    out.push(flatShape([G.circle(cx,cy,halo*0.26)],white));
    return out;
  }
  const effects={extrude,shatter:P.shatter,inset:P.inset,sketch,shadow,neon,flare,emboss,
    warp:(s,v,b)=>deform(s,v,b,false),distort:(s,v,b)=>deform(s,v,b,true),
    color:(s,v)=>s.map(p=>changeInks(p,c=>hue(c,v))),
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
    simplify:(s,v)=>s.map(p=>({...p,paths:p.paths.map(path=>P.simplify(path,v.error))}))};
  function run(id,shapes,values) {
    if (!shapes.length) throw Error("Select at least one path.");
    const controls=VectorCatalog.find(e=>e.id===id).controls,v={};
    for (const c of controls) {
      const val=values[c.key]===undefined ? c.value : values[c.key];
      if (c.options) {
        if (!c.options.includes(val)) throw Error("Unknown "+c.label+".");
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
