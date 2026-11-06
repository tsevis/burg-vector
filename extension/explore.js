/* Genetic-style variations: each child changes a few "genes" (controls) of its parent. */
const VectorExplore = (() => {
  // Which contour and anchor the Point Editor targets is a choice, not a gene.
  const FIXED=new Set(["contour","index"]);
  const genesOf=effect=>effect.controls.filter(c=>!c.color && !FIXED.has(c.key));
  const snap=(c,v)=>{
    const steps=Math.round((Math.max(c.min,Math.min(c.max,v))-c.min)/c.step);
    return Number((c.min+steps*c.step).toFixed(6));
  };
  // amount runs from 0 (subtle) to 1 (wild): it sets how many genes change and how far.
  function mutate(effect,params,amount,rand=Math.random) {
    const pool=genesOf(effect), child={...params};
    const count=Math.min(pool.length,1+Math.floor(amount*Math.min(6,pool.length/2)+rand()));
    for (let tries=0;tries<20 && (tries<count || JSON.stringify(child)===JSON.stringify(params));tries++) {
      const c=pool[Math.floor(rand()*pool.length)];
      if (c.options) {
        const others=c.options.filter(o=>o!==child[c.key]);
        if (others.length && rand()<0.25+amount*0.5) child[c.key]=others[Math.floor(rand()*others.length)];
        continue;
      }
      const span=(c.fineMax===undefined ? c.max : Math.max(c.fineMax,child[c.key]))-c.min;
      const reach=Math.max(c.step,span*(0.04+amount*0.46));
      const moved=snap(c,child[c.key]+(2*rand()-1)*reach);
      child[c.key]=moved===child[c.key] ? snap(c,child[c.key]+(moved<c.max ? c.step : -c.step)) : moved;
    }
    return child;
  }
  return {mutate};
})();
