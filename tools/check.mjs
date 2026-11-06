import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const js=vm.createContext({console,navigator:{userAgent:""},window:{}});
js.window=js; js.self=js;
for (const file of ["vendor/clipper.js","catalog.js","geometry.js","path-effects.js","effects.js"])
  vm.runInContext(readFileSync(join(root,"extension",file),"utf8"),js,{filename:file});
const {catalog,G,run}=vm.runInContext("({catalog:VectorCatalog,G:VectorGeometry,run:VectorEffects.run})",js);
const ring={paths:[G.circle(50,50,40),G.circle(50,50,12)],fill:[228,80,50],stroke:null,width:0,opacity:100,evenodd:true};
const polygon=G.polygon([[28,39],[49,39],[70,39],[70,60],[28,60]]);
const rect={...ring,paths:[polygon],fill:[41,133,160],evenodd:false};
const source=[ring,rect], original=JSON.stringify(source);
const cases=[];
for (const e of catalog) {
  const result=run(e.id,source,{});
  assert.ok(result.length>0,e.name);
  for (const s of result) for (const p of s.paths) for (const q of p.points)
    assert.ok(q.length===6 && q.every(Number.isFinite),e.name);
  assert.equal(JSON.stringify(source),original,"Source mutated in "+e.name);
  assert.equal(JSON.stringify(result),JSON.stringify(run(e.id,source,{})),e.name+" repeatability");
  assert.ok(run(e.id,source,e.preset[1]).length>0,e.name+" preset");
  cases.push({name:e.name,result});
}
assert.equal(cases.length,13);
for (const lens of catalog.find(e=>e.id==="distort").controls[0].options)
  assert.ok(run("distort",source,{lens})[0].paths.length===2);
for (const e of ["extrude","warp","shatter","color","point"]) {
  const data={extrude:{perspective:70},warp:{top:40},shatter:{fracture:"Radial",pieces:2},
    color:{invert:100,gray:100},point:{mode:"Move anchor",contour:2,dx:19,dy:-2}}[e];
  assert.ok(run(e,source,data).length);
}
const only=[rect],box=G.bounds(only);
const inset=G.bounds(run("inset",only,{distance:2}));
assert.ok(Math.abs(inset.w-(box.w-4))<0.001);
assert.equal(run("simplify",only,{error:0.3})[0].paths[0].points.length,4);
assert.equal(run("point",only,{mode:"Subdivide"})[0].paths[0].points.length,6);
const area=p=>p.points.reduce((sum,a,i)=>{
  const b=p.points[(i+1)%p.points.length];return sum+(a[0]*b[1]-a[1]*b[0])/2;
},0);
const fragments=run("shatter",only,{spread:0,spin:0});
const totalArea=fragments.reduce((sum,s)=>sum+Math.abs(s.paths.reduce((a,p)=>a+area(p),0)),0);
assert.ok(Math.abs(totalArea-Math.abs(area(polygon)))<0.05);
const insetRing=run("inset",[ring],{distance:2});
assert.equal(insetRing[0].paths.length,2);
assert.ok(area(insetRing[0].paths[0])*area(insetRing[0].paths[1])<0);
const open={...rect,paths:[{...polygon,closed:false}],fill:null,stroke:[0,0,0],width:2};
for (const id of ["shatter","inset","extrude"]) assert.throws(()=>run(id,[open],{}),/closed/i);
for (const e of catalog.filter(e=>!["shatter","inset","extrude"].includes(e.id)))
  assert.ok(run(e.id,[open],{}).length);
console.log("13/13 effects and presets passed geometry checks. Verified inset, compound holes, shatter area, open paths, source preservation and anchor editing.");

if (process.argv.includes("--illustrator")) {
  const temp=mkdtempSync(join(tmpdir(),"vector-effects-qa-"));
  const script=join(temp,"suite.jsx"), apple=join(temp,"run.applescript");
  const runHost=(file)=>execFileSync("/usr/bin/osascript",[apple,file],
    {encoding:"utf8",timeout:650000,maxBuffer:4*1024*1024}).trim();
  writeFileSync(apple,`on run argv
    set scriptFile to POSIX file (item 1 of argv)
    with timeout of 600 seconds
      tell application id "com.adobe.illustrator" to do javascript scriptFile
    end timeout
  end run`);
  const host=JSON.stringify(join(root,"extension/host.jsx"));
  // Every run owns its scratch document, even when an assertion fails.
  writeFileSync(script,`(function () {
    $.evalFile(new File(${host}));
    var doc=app.documents.add(DocumentColorSpace.RGB,600,400);
    var cases=${JSON.stringify(cases)}, input=${original}, rows=[];
    function check(ok,msg) { if (!ok) throw Error(msg); }
    function decode(s) { var obj=eval("("+s+")");check(!obj.error,obj.error);return obj; }
    function make(s) {
      var parent=s.paths.length>1 ? doc.compoundPathItems.add() : doc.activeLayer;
      var p,col=new RGBColor();col.red=s.fill[0];col.green=s.fill[1];col.blue=s.fill[2];
      for (var i=0;i<s.paths.length;i++) {
        p=parent.pathItems.add();var points=s.paths[i].points,coords=[];
        for(var j=0;j<points.length;j++) coords.push([points[j][0],points[j][1]]);
        p.setEntirePath(coords);p.closed=true;p.filled=true;p.fillColor=col;p.stroked=false;p.evenodd=s.evenodd;
        for(j=0;j<points.length;j++){p.pathPoints[j].leftDirection=points[j].slice(2,4);p.pathPoints[j].rightDirection=points[j].slice(4);}
      }
      return s.paths.length>1 ? parent : p;
    }
    try {
      var ring=make(input[0]),rect=make(input[1]);app.redraw();var initial=doc.activeLayer.pageItems.length;
      function selectSource() { doc.selection=null;ring.selected=true;rect.selected=true; }
      for(var i=0;i<cases.length;i++) {
        selectSource(); var c=cases[i],source=decode(BurgVectorHost.read());
        check(source.shapes[0].fill[0]===input[0].fill[0], "source stacking");
        var count=decode(BurgVectorHost.apply(source.token,c.name,c.result,"above")).count;
        check(count===c.result.length,c.name+" output count");
        var group=doc.selection[0];check(group.typename==="GroupItem" && group.pageItems.length===count,c.name+" group");
        var readback=decode(BurgVectorHost.read()).shapes;
        check(readback.length===count,c.name+" readback count");
        for(var k=0;k<count;k++) {
          var got=readback[k],want=c.result[k];
          check(got.paths.length===want.paths.length,c.name+" contour count");
          check(!!got.fill===!!want.fill && !!got.stroke===!!want.stroke,c.name+" paint");
          for(var ch=0;ch<3;ch++) {
            if(want.fill)check(Math.abs(want.fill[ch]-got.fill[ch])<1.1,c.name+" fill/order");
            if(want.stroke)check(Math.abs(want.stroke[ch]-got.stroke[ch])<1.1,c.name+" stroke/order");
          }
          // Illustrator stores compound path children in reverse insertion order.
          var unused=got.paths.slice();
          for(var m=0;m<want.paths.length;m++){
            var contour=want.paths[m], match=-1;
            for(var n=0;n<unused.length;n++){
              var first=unused[n].points[0],origin=contour.points[0];
              if(unused[n].points.length===contour.points.length && Math.abs(first[0]-origin[0])<0.02 && Math.abs(first[1]-origin[1])<0.02){match=n;break;}
            }
            check(match>=0,c.name+" anchor count/order");var points=unused.splice(match,1)[0].points;
            for(var a=0;a<points.length;a++)for(var xy=0;xy<6;xy++)
              check(Math.abs(points[a][xy]-contour.points[a][xy])<0.02,c.name+" Bezier coordinate");
          }
        }
        group.remove();check(doc.activeLayer.pageItems.length===initial,c.name+" original objects");rows.push(c.name);
      }
      selectSource();var stale=decode(BurgVectorHost.read());rect.translate(2,0);
      check(BurgVectorHost.apply(stale.token,"stale",cases[0].result,"beside").indexOf("changed")>=0,"stale edit");
      selectSource();var token=decode(BurgVectorHost.read()).token;
      var out=decode(BurgVectorHost.apply(token,"placement",input,"beside"));var placed=doc.selection[0];
      check(Math.abs(placed.visibleBounds[0]-ring.visibleBounds[2]-18)<0.02,"beside placement");
      placed.remove();
      selectSource();token=decode(BurgVectorHost.read()).token;
      var rollback=BurgVectorHost.apply(token,"rollback",[input[0],{paths:[]}],"above");
      check(rollback.indexOf("error")>=0 && doc.activeLayer.pageItems.length===initial,"partial output rollback");
      return "PASS Illustrator "+app.version+" | "+rows.join(", ")+" | stacking, Bezier handles, placement, stale artwork and rollback";
    } catch(e) { return "FAIL: "+e.message+" (line "+e.line+")"; }
    finally { doc.close(SaveOptions.DONOTSAVECHANGES); }
  })();`);
  const message=runHost(script);console.log(message);
  assert.ok(message.startsWith("PASS "),message);
}
