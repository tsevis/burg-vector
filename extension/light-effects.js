/* Shadow Echo, Emboss, Neon and Flare: effects that add shaded copies, glows and light. */
const VectorLight = (() => {
  const G=VectorGeometry, K=VectorPaint, rad=Math.PI/180;
  const {ink,white,hex,tint,base,changeInks}=K;
  const mapShape=(s,fn)=>({...s,paths:s.paths.map(p=>G.mapPath(p,fn))});
  const flatShape=(paths,fill,opacity=100)=>({paths,fill,stroke:null,width:0,opacity,evenodd:false});

  // Where copy i of n lands: t runs from the far copy (1) toward the artwork.
  function placer(v,b,i) {
    const t=i/v.steps,ux=Math.cos(v.angle*rad),uy=Math.sin(v.angle*rad);
    if (v.mode==="Cast") {
      // A ground shadow: the base stays put and height is laid along the light direction.
      const k=v.length*t/Math.max(1e-6,b.h);
      return (x,y)=>[x+(y-b.y0)*k*ux,b.y0+(y-b.y0)*k*uy];
    }
    if (v.mode==="Drop") {
      // One offset copy, softened by slightly larger copies stacked under it.
      const g=(i-1)/Math.max(1,v.steps-1),size=Math.max(1,b.w,b.h);
      const k=1+g*v.length*0.6/size,dx=v.length*ux,dy=v.length*uy;
      return (x,y)=>[b.cx+dx+k*(x-b.cx),b.cy+dy+k*(y-b.cy)];
    }
    const k=1+(v.scale/100-1)*t,a=v.spin*t*rad;
    const dx=v.length*t*Math.cos(v.angle*rad),dy=v.length*t*Math.sin(v.angle*rad);
    return (x,y)=>[b.cx+dx+k*((x-b.cx)*Math.cos(a)-(y-b.cy)*Math.sin(a)),
      b.cy+dy+k*((x-b.cx)*Math.sin(a)+(y-b.cy)*Math.cos(a))];
  }
  function shadow(shapes,v,b) {
    const result=[],shade=hex(v.color),amount=v.tint/100;
    for (let i=v.steps;i>=1;i--) {
      const t=i/v.steps,move=placer(v,b,i);
      for (const s of shapes) {
        const shaded=changeInks(mapShape(s,move),c=>tint(c,shade,amount));
        shaded.opacity=s.opacity*(0.7+(v.fade/100-0.7)*t);
        result.push(shaded);
      }
    }
    return result.concat(shapes);
  }
  function emboss(shapes,v) {
    const light=hex(v.highlight),dark=hex(v.shade),n=v.softness,out=[];
    for (const s of shapes) {
      // Softness stacks bands from the outer edge in, each stronger than the last.
      for (let k=n;k>=1;k--) {
        const d=v.depth*k/n,amount=v.contrast/100*(n-k+1)/n;
        const dx=d*Math.cos(v.light*rad),dy=d*Math.sin(v.light*rad);
        out.push(changeInks(mapShape(s,(x,y)=>[x-dx,y-dy]),c=>tint(c,dark,amount)));
        out.push(changeInks(mapShape(s,(x,y)=>[x+dx,y+dy]),c=>tint(c,light,amount)));
      }
      out.push(s);
    }
    return out;
  }
  function neon(shapes,v) {
    const custom=v.colors==="Custom",tube=hex(v.tube),glow=hex(v.glowColor);
    const curve=Math.pow(2,(v.falloff-50)/25),out=[];
    for (const s of shapes) {
      if (s.fill) out.push({...s,stroke:null});
      const c=custom ? glow : s.stroke||base(s);
      const band=(width,stroke,opacity)=>({...s,fill:null,stroke,width,opacity:s.opacity*Math.min(1,opacity),
        cap:"round",join:"round",dash:[]});
      for (let i=v.bands;i>0;i--) {
        const t=i/v.bands;
        out.push(band(v.width*(0.35+1.65*t),c,v.glow/100*(1.1-0.65*Math.pow(t,curve))));
      }
      out.push(band(v.width*0.35,custom ? tube : tint(c,white,0.65),1),band(v.width*0.13,white.slice(),1));
    }
    return out;
  }
  // Lens ghosts sit on the line from the flare through the artwork's centre.
  function ghosts(v,b,cx,cy,halo,color) {
    const rand=G.random(v.seed+7919),out=[],size=Math.max(1,b.w,b.h);
    let ux=b.cx-cx,uy=b.cy-cy;
    if (Math.hypot(ux,uy)<size*0.05) {ux=-Math.cos(v.angle*rad)*size/2;uy=-Math.sin(v.angle*rad)*size/2;}
    for (let i=1;i<=v.rings;i++) {
      const along=0.5+i*0.45+0.2*rand(),r=halo*(0.15+0.55*rand());
      out.push(flatShape([G.circle(cx+ux*along,cy+uy*along,r)],tint(color,white,0.25+0.3*rand()),10+12*rand()));
    }
    return out;
  }
  function flare(shapes,v,b) {
    const out=shapes.slice(),cx=b.x0+b.w*v.cx/100,cy=b.y0+b.h*v.cy/100;
    const size=Math.max(1,Math.max(b.w,b.h)/2),halo=size*v.halo/100;
    const color=v.colors==="Custom" ? hex(v.flareColor) : tint(base(shapes[shapes.length-1]),[255,195,86],0.7);
    const rand=G.random(v.seed),jitter=v.jitter/100;
    for (let i=10;i>=1;i--) out.push(flatShape([G.circle(cx,cy,halo*i/10)],color,4+(10-i)*1.2));
    out.push(...ghosts(v,b,cx,cy,halo,color));
    for (let i=0;i<v.rays;i++) {
      const turn=jitter ? (2*rand()-1)*jitter*180/v.rays : 0,reach=jitter ? 1-0.7*jitter*rand() : 1;
      const a=(v.angle+i*360/v.rays+turn)*rad,ux=Math.cos(a),uy=Math.sin(a);
      const len=size*v.radius/100*(i%2 ? 0.6 : 1)*reach,half=halo*0.15;
      out.push(flatShape([G.polygon([[cx-uy*half,cy+ux*half],[cx+ux*len,cy+uy*len],
        [cx+uy*half,cy-ux*half]])],tint(color,white,0.55),80));
    }
    out.push(flatShape([G.circle(cx,cy,halo*0.26)],white.slice()));
    return out;
  }
  return {shadow,emboss,neon,flare,ink};
})();
