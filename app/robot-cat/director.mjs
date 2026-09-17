export class CatDirector {
 constructor(manifest,{random=Math.random,onPlay=()=>{},reducedMotion=false}={}){
  this.manifest=manifest;this.random=random;this.onPlay=onPlay;this.auto=!reducedMotion;this.paused=reducedMotion;this.current='Idle';this.elapsed=0;this.total=0;this.history=[];this.nextIdle=this.delay();this.lastChase=-100;this.turns=0;this.faceOverride='';
 }
 delay(){const [a,b]=this.manifest.idleDelay;return a+(b-a)*this.random();}
 play(name,{user=false}={}){
  if(!this.manifest.clips[name])throw Error(`Unknown behavior: ${name}`);
  if(user)this.paused=false;
  this.current=name;this.elapsed=0;this.nextIdle=this.delay();this.history.push(name);this.history=this.history.slice(-20);
  if(name==='TailChase')this.lastChase=this.total;
  this.onPlay(name);return name;
 }
 nextBehavior(){
  this.turns++;
  if(this.turns===1)return 'LookAround';
  if(this.turns===2)return 'TailChase';
  const pool=['LookAround','Curious','Curious','Stretch','Greet','Drowsy','PlayfulHop'];
  if(this.total-this.lastChase>35)pool.push('TailChase');
  const last=this.history.filter(n=>n!=='Idle').at(-1);const choices=pool.filter(n=>n!==last);
  return choices[Math.floor(this.random()*choices.length)];
 }
 update(dt){
  if(this.paused)return;
  dt=Math.max(0,Math.min(dt,.1));this.elapsed+=dt;this.total+=dt;
  if(this.current==='Idle'){
   if(this.auto&&this.elapsed>=this.nextIdle)this.play(this.nextBehavior());
  }else if(this.elapsed>=this.manifest.clips[this.current].duration){this.play(this.current==='Drowsy'?'WakeUp':'Idle');}
 }
 touch(region){return this.play(({head:'Affection',screen:'Boop',ear:'EarTwitch',paw:'Greet',tail:'TailChase',body:'Curious'})[region]||'Curious',{user:true});}
 expression(){
  if(this.faceOverride)return this.faceOverride;
  const clip=this.manifest.clips[this.current],t=clip.loop?this.elapsed%clip.duration:this.elapsed;
  return clip.faceCues.findLast(c=>c.time<=t)?.expression||'happy';
 }
}
