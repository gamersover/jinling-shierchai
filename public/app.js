(() => {
'use strict';
const $=id=>document.getElementById(id),data=window.BOOK_DATA,entries=data.entries;
const nums=['一','二','三','四','五','六','七','八','九','十','十一'];
const {clamp,ease,paperPose}=window.BookMotion;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const narrow=matchMedia('(max-width: 700px), (max-width: 900px) and (orientation: portrait)');
let singlePage=narrow.matches;
const book=$('book'),spread=$('spread'),hinge=$('coverHinge'),shadow=$('turnShadow');
let index=0,readingAnchor=0,phase='closed',epoch=0,frame=0,settle=null,turn=null,gesture=null,returnFocus=null,pendingFocus=null,suppressClickUntil=0;
const imageCache=new Map();
// Load local book fonts before moving text through the segmented paper surface.
const bookFonts=document.fonts?Promise.all([
 document.fonts.load('400 32px "Jinling Yan Light"','金陵十二釵'),
 document.fonts.load('400 24px "Jinling Poem Kai"','可嘆停機德'),
 document.fonts.load('400 16px "Jinling Serif"','正冊圖')
]).catch(()=>{}):Promise.resolve();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function loadImage(i){
 if(i<0||i>=entries.length*2)return Promise.resolve(true);
 i=Math.floor(i/2);
 if(imageCache.has(i))return imageCache.get(i).promise;
 const record={images:[],ready:false,promise:null};
 // Keep both the picture and the calligraphy ready before cloning a paper face.
 // WebKit can defer decode() on detached images, so readiness uses load events.
 const sources=[entries[i].image,entries[i].lettering].filter(Boolean);
 record.promise=Promise.all(sources.map(src=>new Promise(resolve=>{
  const img=new Image();record.images.push(img);
  img.onload=()=>resolve(true);img.onerror=()=>resolve(false);img.src=src;
 }))).then(results=>{record.ready=results.every(Boolean);return record.ready;});
 imageCache.set(i,record);return record.promise;
}
const pictureCorners='<div class="picture-corners" aria-hidden="true"><i class="picture-border top"></i><i class="picture-border bottom"></i><i class="picture-border left"></i><i class="picture-border right"></i><i class="picture-corner top-left"></i><i class="picture-corner top-right"></i><i class="picture-corner bottom-left"></i><i class="picture-corner bottom-right"></i></div>';
function folioHTML(i){
 if(i<0||i>=entries.length*2)return '';
 const entry=Math.floor(i/2),d=entries[entry],verse=i%2===1;
 const longest=Math.max(...d.displayPoem.map(p=>[...p].length));
 const verseText=d.displayPoem.map(p=>'<p>'+esc(p)+'</p>').join('');
 const content=verse&&d.lettering?'<div class="poem-art" aria-hidden="true"><img src="'+d.lettering+'" alt="" draggable="false" decoding="sync"></div><div class="sr-only poem-text" aria-label="判词">'+verseText+'</div>':verse?'<div class="poem" aria-label="判词" style="--verse-height-size:'+(52/(longest*1.3)).toFixed(3)+'cqh">'+d.displayPoem.map(p=>'<p>'+esc(p)+'</p>').join('')+'</div>':'<div class="art"><img src="'+d.image+'" alt="依原文绘意：'+esc(d.drawing)+'" width="1086" height="1448" draggable="false" decoding="sync"></div>';
 return (verse?'':pictureCorners)+'<div class="folio '+(verse?'verse-folio':'picture-folio')+'" data-entry="'+entry+'">'+content+'</div>';
}
// Each entry is a painting leaf followed by a judgment leaf. Desktop displays
// the pair together; narrow layouts keep the exact physical leaf as the anchor.
const firstIndex=()=>0;
const spreadStart=i=>singlePage?i:Math.floor(i/2)*2;
const lastIndex=()=>spreadStart(entries.length*2-1);
const stepIndex=direction=>index+direction*(singlePage?1:2);
const shownIndices=()=>[Math.floor(index/2)];
const loadSpread=i=>loadImage(i);
function renderCoverInside(){ $('coverInside').innerHTML=singlePage?'':folioHTML(index+1); }
function setPhase(next){
 phase=next;book.dataset.phase=next;book.setAttribute('aria-busy',String(!['closed','open'].includes(next)));
 const isOpen=next==='open',closedUI=['closed','closing','loading-open'].includes(next);
 $('readerControls').hidden=closedUI;
 $('readerActions').hidden=closedUI;
 $('cover').inert=next!=='closed';
 spread.inert=!['open','turning','preparing'].includes(next);
 $('nextButton').disabled=$('nextHit').disabled=!isOpen||index===lastIndex();
 $('prevButton').disabled=$('prevHit').disabled=!isOpen||index===firstIndex();
 $('closeButton').disabled=$('catalogButton').disabled=$('folioSelect').disabled=$('textButton').disabled=$('artView').disabled=$('poemView').disabled=!isOpen;
 $('sourceButton').disabled=!['closed','open'].includes(next);
}
function render(){
 // Keep the same live controls in the visible toolbar's stacking context.
 const actions=$('readerActions'),actionHost=singlePage?$('headerActions'):$('readerControls');
 if(actions.parentNode!==actionHost)actionHost.appendChild(actions);
 $('leftLeaf').innerHTML=folioHTML(index);$('rightLeaf').innerHTML=singlePage?'':folioHTML(index+1);renderCoverInside();
 const shown=shownIndices();
 $('folioNumber').textContent=shown.map(i=>nums[i]).join(' · ')+' / 十一';
 $('folioName').textContent=shown.map(i=>entries[i].nameLabel).join(' · ');
 $('folioSelect').setAttribute('aria-label','目录：第'+nums[shown[0]]+'幅，'+entries[shown[0]].nameLabel);
 $('leafMode').hidden=!singlePage;
 $('artView').setAttribute('aria-pressed',String(index%2===0));$('poemView').setAttribute('aria-pressed',String(index%2===1));
 $('nextButton').setAttribute('aria-label',singlePage?'后一叶':'后一幅');$('prevButton').setAttribute('aria-label',singlePage?'前一叶':'前一幅');
 $('nextHit').setAttribute('aria-label',singlePage?'翻到下一叶':'翻到下一幅');$('prevHit').setAttribute('aria-label',singlePage?'翻到上一叶':'翻到上一幅');
 book.dataset.page=String(shown[0]+1);book.dataset.leaf=String(index);book.dataset.view=singlePage?(index%2?'poem':'art'):'spread';book.dataset.layout=singlePage?'single':'spread';setPhase(phase);
}
function announce(){const i=Math.floor(index/2);$('announcement').textContent='第'+nums[i]+'幅，'+entries[i].nameLabel+'。'+(singlePage&&index%2===0?'图叶。'+entries[i].drawing:'判词。'+entries[i].poem.join(''));}
function restoreFocus(){
 if(!pendingFocus)return;
 const el=pendingFocus;pendingFocus=null;
 (el.isConnected&&!el.disabled&&!el.closest('[inert],[hidden]')?el:$('catalogButton')).focus({preventScroll:true});
}
function animate(from,to,duration,paint,done){
 const id=++epoch;cancelAnimationFrame(frame);const began=performance.now();let finished=false;
 const finish=()=>{if(finished||id!==epoch)return;finished=true;cancelAnimationFrame(frame);paint(to);settle=null;done();};
 settle=finish;paint(from);
 if(reduced.matches||duration<35){finish();return;}
 function step(now){if(id!==epoch)return;const t=clamp((now-began)/duration);paint(from+(to-from)*ease(t));if(t<1)frame=requestAnimationFrame(step);else finish();}
 frame=requestAnimationFrame(step);
}
function coverPose(p){
 book.style.transform='translate3d('+(singlePage?0:(1-p)*25)+'%,0,0)';
 hinge.style.transform='rotateY('+(p*180)+'deg)';
 hinge.style.setProperty('--cover-shade',String(Math.sin(Math.PI*p)*.36));
 book.dataset.progress=p.toFixed(3);
}
async function openBook(){
 if(phase!=='closed')return;
 const id=++epoch;setPhase('loading-open');
 const [imageLoaded]=await Promise.all([loadSpread(index),bookFonts]);
 if(!imageLoaded){if(id===epoch){setPhase('closed');$('announcement').textContent='插图加载失败，请刷新页面重试。';}return;}
 if(id!==epoch)return;
 renderCoverInside();setPhase('opening');
 animate(0,1,1080,coverPose,()=>{setPhase('open');announce();$('catalogButton').focus({preventScroll:true});});
}
function closeBook(){
 if(phase!=='open')return;
 gesture=null;
 renderCoverInside();setPhase('closing');
 animate(1,0,980,coverPose,()=>{setPhase('closed');$('announcement').textContent='已合卷，再次展卷将回到第'+nums[Math.floor(readingAnchor/2)]+'幅。';$('cover').focus({preventScroll:true});});
}
function prepareTurn(target,anchor=Math.max(0,target)){
 const forward=target>index,width=$('leftLeaf').getBoundingClientRect().width,height=$('leftLeaf').getBoundingClientRect().height,count=18,sw=width/count;
 const physicalForward=singlePage||forward;
 const layer=document.createElement('div');layer.className='turn-layer '+(physicalForward?'forward':'backward')+(singlePage?' single-turn':'');layer.setAttribute('aria-hidden','true');
 const front=singlePage?folioHTML(forward?index:target):folioHTML(forward?index:index+1),back=singlePage?'':folioHTML(forward?target+1:target),strips=[];
 for(let col=0;col<count;col++){
  const strip=document.createElement('div');strip.className='paper-strip';strip.style.width=sw+'px';
  strip.innerHTML='<div class="strip-face front"><div class="leaf strip-page '+(forward?'left-leaf':'right-leaf')+'" style="width:'+width+'px;height:'+height+'px;left:'+(-col*sw+1.5)+'px">'+front+'</div></div><div class="strip-face back"><div class="leaf strip-page '+(forward?'right-leaf':'left-leaf')+'" style="width:'+width+'px;height:'+height+'px;left:'+(-(count-1-col)*sw+1.5)+'px">'+back+'</div></div>';
  layer.appendChild(strip);strips[col]=strip;
 }
 if(singlePage){if(forward)$('leftLeaf').innerHTML=folioHTML(target);}
 else if(forward)$('leftLeaf').innerHTML=folioHTML(target);else $('rightLeaf').innerHTML=folioHTML(target+1);
 spread.appendChild(layer);shadow.classList.toggle('backward',!forward);
 turn={target,anchor,forward,physicalForward,singlePage,width,count,layer,strips,progress:0};setPhase('turning');paintTurn(0);
}
function paintTurn(p){
 if(!turn)return;turn.progress=p;book.dataset.progress=p.toFixed(3);
 const paperProgress=turn.singlePage&&!turn.forward?1-p:p;
 for(const pose of paperPose(turn.width,turn.count,paperProgress,turn.physicalForward)){
  const el=turn.strips[pose.column];el.style.transform='translate3d('+pose.x.toFixed(3)+'px,0,'+pose.z.toFixed(3)+'px) rotateY('+pose.degrees.toFixed(3)+'deg)';el.style.setProperty('--shade',pose.shade.toFixed(3));
 }
 const arc=Math.sin(Math.PI*p);shadow.style.opacity=String(arc*.45);shadow.style.width=(8+arc*38)+'%';
}
function finishTurn(commit){
 if(!turn)return;settle=null;if(commit){index=turn.target;readingAnchor=turn.anchor;}
 turn.layer.remove();turn=null;shadow.style.opacity='0';shadow.style.width='0';
 setPhase('open');render();announce();restoreFocus();
}
async function turnTo(target){
 const anchor=Math.max(0,target);
 target=spreadStart(target);
 if(phase!=='open'||target<firstIndex()||target>lastIndex())return;
 if(target===index){if(anchor<entries.length*2)readingAnchor=anchor;return;}
 gesture=null;pendingFocus=document.activeElement?.closest('button')||pendingFocus;
 const id=++epoch;setPhase('preparing');
 const loaded=await loadSpread(target);if(id!==epoch)return;
 if(!loaded){setPhase('open');$('announcement').textContent='插图加载失败，请刷新页面重试。';restoreFocus();return;}
 prepareTurn(target,anchor);animate(0,1,singlePage?680:900,paintTurn,()=>finishTurn(true));
}
function showDialog(title,eyebrow,body){gesture=null;returnFocus=document.activeElement;$('dialogEyebrow').textContent=eyebrow;$('dialogContent').innerHTML='<h2 id="dialogTitle">'+title+'</h2>'+body;$('infoDialog').showModal();}
function showCatalog(){
 showDialog('金陵十二钗','正册目录','<p class="note">人物姓名为阅读对应，原册未逐页题名。</p><ol class="catalog-list">'+entries.map((d,i)=>'<li><button data-page="'+i+'" class="'+(shownIndices().includes(i)?'active':'')+'" '+(shownIndices().includes(i)?'aria-current="page"':'')+'><span>'+nums[i]+'</span>'+esc(d.names.join(' · '))+'</button></li>').join('')+'</ol>');
 $('dialogContent').querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{const target=Number(b.dataset.page);pendingFocus=$('catalogButton');$('infoDialog').close();turnTo(target*2);}));
}
function showText(){
 showDialog(shownIndices().map(i=>esc(entries[i].nameLabel)).join(' · '),'释文与画意',
 shownIndices().map(i=>{const d=entries[i];return '<section class="folio-transcript"><h3>第'+nums[i]+'幅 · '+esc(d.names.join(' · '))+'</h3><p class="source-quote">'+esc(d.drawingOriginalExcerpt)+'</p><p>'+d.poem.map(esc).join('<br>')+'</p>'+(d.variants.length?d.variants.map(v=>'<p class="note">'+esc(v.note)+'</p>').join(''):'')+'</section>';}).join('')+
 '<p class="note">本册依程乙本第五回，册页采用繁体排印；此处为简体释文。配图据文字意象创作。</p><p><a href="'+data.sourceUrl+'" target="_blank" rel="noopener noreferrer">阅读第五回原文 ↗</a></p>');
}
function showSource(){showDialog('关于此册','太虚幻境 · 薄命司',
 '<p>宝玉在太虚幻境的薄命司，取阅“金陵十二钗正册”。这册中有十二位女子的命运隐语；宝钗与黛玉合用一图一判，故共十一幅画、十一首判词。</p>'+
 '<h3>文字底本</h3><p>正文统一采用《红楼梦》程乙本第五回。册页以繁体竖排呈现，画意和释文用简体整理。元春判词取“虎兔”，巧姐判词取“济刘氏”；常见异文在相关页另注。</p>'+
 '<h3>册式参考</h3><p>第五回写到册子、图画和判词，没有规定封面颜色、材质、开本或订线。本页参照明清线装书的薄纸衣、右侧四眼订线与折叶，选用磁青纸衣和淡米色纸页。每一幅图判占一个完整对开，左图右书；窄屏依次阅图叶与判词叶，合为十一组、二十二叶。这些排布是本页的阅读设计。</p><p><a href="https://www.dpm.org.cn/ancient/yuanmingqing/147061.html" target="_blank" rel="noopener noreferrer">故宫藏《仙屏书屋初集》与书衣说明 ↗</a><br><a href="https://www.nlc.cn/web/yejiefuwu/gtqk/wjls/wjqcsy/wj2022/wjd77q/index.shtml" target="_blank" rel="noopener noreferrer">国家图书馆《文津流觞》：传统书籍装帧 ↗</a></p>'+
 '<h3>书法与字体</h3><p>判词以已确认的视觉原型为参照，由 AI 重绘为透明书法字稿，逐字核对后呈现。它是本页的书法视觉创作，不是名家手迹或古代原件。准确判词同时保留为可访问文本，并可在“释文”中查阅。</p><p>题签与站点标题仍采用全字库正楷体（TW-Kai），来源为数位发展部 CNS11643 全字库，依 SIL Open Font License 1.1 使用。</p><p><a href="https://www.cns11643.gov.tw/pageView.jsp?ID=59" target="_blank" rel="noopener noreferrer">全字库字体授权与来源 ↗</a></p>'+
 '<h3>图画与材质</h3><p>小说以文字描述册中图画，没有留下可据以复原的唯一原图。本页十一幅水墨淡彩图依原文意象由 AI 绘制，磁青纸衣与图页纸纹也为 AI 创作。判词页采用用户提供的梅竹山水底纹原图；它们与所选装帧共同构成艺术再现。</p>'+
 '<p>人物姓名只放在阅读导航与释文中，不题进册页。书中随后演唱的“红楼梦曲”与正册判词不同，未收入本册。</p>'+
 '<h3>原文与校读</h3><p>'+data.sources.map(s=>'<a href="'+s.url+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+' ↗</a>').join('<br>')+'</p>');}
$('cover').onclick=openBook;$('closeButton').onclick=closeBook;
$('home').onclick=e=>{e.preventDefault();closeBook();};
$('nextButton').onclick=()=>turnTo(stepIndex(1));$('prevButton').onclick=()=>turnTo(stepIndex(-1));
$('nextHit').onclick=()=>{if(performance.now()>suppressClickUntil)turnTo(stepIndex(1));};
$('prevHit').onclick=()=>{if(performance.now()>suppressClickUntil)turnTo(stepIndex(-1));};
$('catalogButton').onclick=$('folioSelect').onclick=showCatalog;
$('artView').onclick=()=>turnTo(Math.floor(index/2)*2);$('poemView').onclick=()=>turnTo(Math.floor(index/2)*2+1);$('textButton').onclick=showText;$('sourceButton').onclick=showSource;
$('infoDialog').querySelector('.dialog-close').onclick=()=>$('infoDialog').close();
$('infoDialog').addEventListener('click',e=>{if(e.target!==$('infoDialog'))return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();});
$('infoDialog').addEventListener('close',()=>{if(phase==='open'||phase==='closed')returnFocus?.focus({preventScroll:true});else pendingFocus=returnFocus;});
document.addEventListener('keydown',e=>{
 if($('infoDialog').open||phase!=='open'||e.altKey||e.metaKey||e.ctrlKey)return;
 if(e.key==='ArrowLeft'){e.preventDefault();turnTo(stepIndex(1));}if(e.key==='ArrowRight'){e.preventDefault();turnTo(stepIndex(-1));}
 if(e.key==='Home'){e.preventDefault();turnTo(0);}if(e.key==='End'){e.preventDefault();turnTo(entries.length*2-1);}if(e.key==='Escape')closeBook();
});
spread.style.touchAction='pan-y';
spread.addEventListener('pointerdown',e=>{
 if(phase!=='open'||!e.isPrimary||e.button!==0)return;
 suppressClickUntil=0;
 gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastTime:performance.now(),speed:0,direction:0,started:false};
});
spread.addEventListener('pointermove',e=>{
 const g=gesture;if(!g||g.id!==e.pointerId)return;
 if(!g.started&&phase!=='open'){gesture=null;return;}
 const dx=e.clientX-g.x,dy=e.clientY-g.y,now=performance.now();
 g.speed=(e.clientX-g.lastX)/Math.max(1,now-g.lastTime);g.lastX=e.clientX;g.lastTime=now;
 if(!g.started){
  if(Math.abs(dy)>Math.abs(dx)*1.3&&Math.abs(dy)>12){gesture=null;return;}
  if(Math.abs(dx)<10)return;
  g.direction=dx>0?1:-1;const target=stepIndex(g.direction);
  if(target<firstIndex()||target>lastIndex()){gesture=null;return;}
  if(!imageCache.get(Math.floor(target/2))?.ready)return;
  g.started=true;pendingFocus=null;prepareTurn(target);spread.setPointerCapture(e.pointerId);
  settle=()=>finishTurn(turn?.progress>.5);
 }
 if(e.cancelable)e.preventDefault();
 paintTurn(clamp(dx*g.direction/(turn.width*1.55)));
});
function endGesture(e,cancelled=false){
 const g=gesture;if(!g||g.id!==e.pointerId)return;gesture=null;
 if(spread.hasPointerCapture(e.pointerId))spread.releasePointerCapture(e.pointerId);
 if(!g.started){if(g.direction&&!cancelled){suppressClickUntil=performance.now()+500;turnTo(stepIndex(g.direction));}return;}
 suppressClickUntil=performance.now()+650;
 const p=turn.progress,velocity=performance.now()-g.lastTime<120?g.speed:0,commit=!cancelled&&(p>.26||(velocity*g.direction>.45&&p>.06));
 animate(p,commit?1:0,Math.max(240,680*Math.abs((commit?1:0)-p)),paintTurn,()=>finishTurn(commit));
}
spread.addEventListener('pointerup',e=>endGesture(e));
spread.addEventListener('pointercancel',e=>endGesture(e,true));
spread.addEventListener('lostpointercapture',e=>{if(gesture?.id===e.pointerId)endGesture(e,true);});
function settleForLayout(){
 const captureId=gesture?.id;gesture=null;
 if(captureId!==undefined&&spread.hasPointerCapture(captureId))spread.releasePointerCapture(captureId);
 if(settle)settle();
 else if(phase==='preparing'){++epoch;setPhase('open');restoreFocus();}
 else if(phase==='loading-open'){++epoch;setPhase('closed');}
}
function syncLayout(){
 settleForLayout();
 singlePage=narrow.matches;index=spreadStart(readingAnchor);render();coverPose(phase==='closed'?0:1);if(phase==='open')announce();
}
window.addEventListener('resize',syncLayout);
narrow.addEventListener('change',syncLayout);
window.addEventListener('blur',()=>{if(gesture?.started)settleForLayout();else gesture=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden)settleForLayout();});
reduced.addEventListener('change',settleForLayout);
render();coverPose(0);entries.forEach((_,i)=>loadImage(i*2));
})();
