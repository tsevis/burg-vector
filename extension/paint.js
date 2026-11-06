/* Colour helpers shared by the effects, and the Color Shift pipeline. Colours are [r,g,b] 0–255. */
const VectorPaint = (() => {
  const G=VectorGeometry;
  const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
  const ink=Object.freeze([20,19,28]), white=Object.freeze([255,252,246]);
  const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const tint=(color,target,t)=>G.mix(color.slice(0,3),target,t).map(Math.round);
  const base=s=>s.fill || s.stroke || ink;
  const changeInks=(s,fn)=>({...s,fill:s.fill && fn(s.fill),stroke:s.stroke && fn(s.stroke)});
  const luminance=c=>0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
  function hue(color,v,turn=0) {
    const lum=luminance(color);
    const [r,g,b]=color.slice(0,3).map(channel=>{
      let x=channel+(lum-channel)*v.gray/100;
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
    h=((h/6+(v.hue+turn)/360)%1+1)%1;
    s=clamp(s+v.sat/100,0,1); l=clamp(l+v.lum/100,0,1);
    const a=s*Math.min(l,1-l);
    return [0,8,4].map(n=>{
      const k=(n+h*12)%12;
      return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));
    });
  }
  // Moves toward the target colour rescaled to this colour's luminance, so shading survives.
  function colorize(color,target,amount) {
    if (!amount) return color;
    const k=luminance(color)/Math.max(1,luminance(target));
    return tint(color,target.map(c=>clamp(c*k,0,255)),amount);
  }
  function posterize(color,levels) {
    if (!levels) return color;
    const n=Math.max(2,levels)-1;
    return color.map(c=>Math.round(Math.round(c/255*n)/n*255));
  }
  function shift(shapes,v) {
    const rand=G.random(v.seed),target=hex(v.target);
    return shapes.map(s=>{
      const turn=v.random ? (2*rand()-1)*v.random/100*180 : 0;
      return changeInks(s,c=>posterize(colorize(hue(c,v,turn),target,v.colorize/100),v.posterize));
    });
  }
  return {ink,white,hex,tint,base,changeInks,shift};
})();
