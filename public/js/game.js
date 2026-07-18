/* ============================================================
   JUEGO CLANDESTINO — motor de pelea (Phaser 3)
   Durable: Phaser local, la imagen NO bloquea el arranque.
   ============================================================ */
'use strict';

const W = 920, H = 540, GROUND = 470, GRAV = 1500;

/* ---------------- INPUT unificado (teclado + botones) ---------------- */
const input = { left:false, right:false, down:false, jump:false, punch:false, kick:false, enter:false };

/* ---------------- SONIDO (Web Audio, sin archivos) ---------------- */
const Sfx = {
  ctx: null,
  ensure(){ if(!this.ctx){ try{ this.ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
            if(this.ctx && this.ctx.state==='suspended') this.ctx.resume(); },
  tone(freq,dur,type,vol,slideTo){ this.ensure(); if(!this.ctx) return;
    const t=this.ctx.currentTime, o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type||'square'; o.frequency.setValueAtTime(freq,t);
    if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo,t+dur);
    g.gain.setValueAtTime(vol||0.2,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t+dur); },
  noise(dur,vol){ this.ensure(); if(!this.ctx) return;
    const t=this.ctx.currentTime, n=this.ctx.createBufferSource();
    const buf=this.ctx.createBuffer(1,Math.max(1,this.ctx.sampleRate*dur),this.ctx.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
    n.buffer=buf; const g=this.ctx.createGain(); g.gain.setValueAtTime(vol||0.25,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    n.connect(g).connect(this.ctx.destination); n.start(t); n.stop(t+dur); },
  hit(){ this.tone(170,0.12,'triangle',0.25,60); this.noise(0.09,0.18); },
  kick(){ this.tone(110,0.18,'sawtooth',0.28,45); this.noise(0.12,0.22); },
  block(){ this.tone(240,0.06,'square',0.12); },
  jump(){ this.tone(320,0.12,'square',0.14,640); },
  ko(){ this.tone(420,0.5,'sawtooth',0.3,60); },
  fight(){ this.tone(520,0.1,'square',0.2); setTimeout(()=>this.tone(720,0.16,'square',0.2),110); },
  // música de fondo (chiptune) con toggle
  musicTimer:null, mStep:0, melody:[330,392,494,588,494,392,330,262,294,349,440,349],
  toggleMusic(){
    this.ensure();
    if(this.musicTimer){ clearInterval(this.musicTimer); this.musicTimer=null; return false; }
    this.musicTimer=setInterval(()=>{
      const f=this.melody[this.mStep%this.melody.length]; this.mStep++;
      this.tone(f,0.16,'triangle',0.05);                 // melodía
      if(this.mStep%2===0) this.tone(f/2,0.22,'square',0.035); // bajo
    },250);
    return true;
  }
};

window.addEventListener('keydown', e => {
  Sfx.ensure();
  switch (e.code) {
    case 'ArrowLeft':  input.left = true;  e.preventDefault(); break;
    case 'ArrowRight': input.right = true; e.preventDefault(); break;
    case 'ArrowDown':  input.down = true;  e.preventDefault(); break;
    case 'ArrowUp':    input.jump = true;  e.preventDefault(); break;
    case 'KeyZ':       input.punch = true; break;
    case 'KeyX':       input.kick = true;  break;
    case 'Enter':      input.enter = true; break;
  }
});
window.addEventListener('keyup', e => {
  if (e.code === 'ArrowLeft')  input.left = false;
  if (e.code === 'ArrowRight') input.right = false;
  if (e.code === 'ArrowDown')  input.down = false;
});
function wireButtons() {
  document.querySelectorAll('#pad .btn').forEach(b => {
    const k = b.dataset.k;
    const press = e => { e.preventDefault(); Sfx.ensure(); b.classList.add('on');
      if (k === 'up') input.jump = true;
      else if (k === 'punch') input.punch = true;
      else if (k === 'kick') input.kick = true;
      else input[k] = true; };
    const release = e => { e.preventDefault(); b.classList.remove('on');
      if (k === 'left' || k === 'right' || k === 'down') input[k] = false; };
    ['pointerdown','mousedown','touchstart'].forEach(ev => b.addEventListener(ev, press, {passive:false}));
    ['pointerup','pointerleave','pointercancel','mouseup','touchend'].forEach(ev => b.addEventListener(ev, release, {passive:false}));
  });
}

/* ---------------- helpers de dibujo (fallback ilustrado) ---------------- */
function C(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function ell(x,cx,cy,rx,ry,col,rot=0){x.save();x.translate(cx,cy);x.rotate(rot);x.beginPath();x.ellipse(0,0,rx,ry,0,0,7);x.fillStyle=col;x.fill();x.restore();}
function rr(x,X,Y,w,h,r,col){x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+w,Y,X+w,Y+h,r);x.arcTo(X+w,Y+h,X,Y+h,r);x.arcTo(X,Y+h,X,Y,r);x.arcTo(X,Y,X+w,Y,r);x.closePath();x.fillStyle=col;x.fill();}
function camo(x,X,Y,w,h){
  rr(x,X,Y,w,h,6,'#5b6338');
  const blobs=[[.15,.2,.22],[.55,.12,.26],[.78,.35,.2],[.3,.55,.28],[.62,.7,.24],[.1,.78,.2],[.85,.72,.18],[.42,.32,.16]];
  const cols=['#3f4726','#77794a','#8a7248','#2c3119'];
  x.save();x.beginPath();rr(x,X,Y,w,h,6,'#000');x.clip();
  blobs.forEach((b,i)=>ell(x,X+b[0]*w,Y+b[1]*h,b[2]*w*.6,b[2]*h*.5,cols[i%4]));
  x.restore();
}
function shade(x,cx,cy,rx,ry,c1,c2){
  const g=x.createRadialGradient(cx-rx*.3,cy-ry*.4,ry*.2,cx,cy,rx*1.1);
  g.addColorStop(0,c1);g.addColorStop(1,c2);
  x.save();x.beginPath();x.ellipse(cx,cy,rx,ry,0,0,7);x.fillStyle=g;x.fill();x.restore();
}
function heroCanvas(){
  const c=C(150,210),x=c.getContext('2d');
  const SKINd='#b0774d',SKINh='#e6b487';
  ell(x,75,204,44,8,'rgba(0,0,0,.35)');
  camo(x,52,138,20,60); camo(x,80,138,20,60);
  rr(x,50,196,26,12,4,'#241d14'); rr(x,76,196,26,12,4,'#241d14');
  camo(x,42,96,66,66);
  rr(x,64,100,22,60,4,'#2f2a20'); rr(x,68,104,14,40,3,'#3c5a3c');
  camo(x,34,100,20,52); camo(x,96,100,20,50);
  shade(x,44,156,12,12,SKINh,SKINd); shade(x,106,152,12,12,SKINh,SKINd);
  rr(x,30,150,20,20,7,'#6f4423'); ell(x,40,159,9,9,'#8a5a2f'); rr(x,44,138,4,16,2,'#c9c9c9');
  rr(x,66,86,22,16,4,SKINd);
  shade(x,77,60,30,34,SKINh,SKINd);
  ell(x,48,60,6,9,SKINd); ell(x,106,60,6,9,SKINd);
  x.fillStyle='#241811';
  x.beginPath();x.moveTo(50,58);x.quadraticCurveTo(48,96,77,104);x.quadraticCurveTo(106,96,104,58);
  x.quadraticCurveTo(96,86,77,88);x.quadraticCurveTo(58,86,50,58);x.closePath();x.fill();
  ell(x,77,92,26,16,'#241811'); ell(x,77,94,20,9,'#33241a');
  rr(x,70,80,14,4,2,'#7a3b34');
  ell(x,77,72,7,9,SKINd); ell(x,77,70,5,6,SKINh);
  ell(x,66,62,6,4,'#fff'); ell(x,88,62,6,4,'#fff');
  ell(x,66,62,3,3,'#2a1c12'); ell(x,88,62,3,3,'#2a1c12');
  rr(x,60,54,14,4,2,'#241811'); rr(x,80,54,14,4,2,'#241811');
  x.save();
  const tg=x.createLinearGradient(46,20,110,40);tg.addColorStop(0,'#f4f1e6');tg.addColorStop(1,'#d7d1bf');
  x.fillStyle=tg;
  x.beginPath();x.moveTo(48,52);x.quadraticCurveTo(44,14,77,12);x.quadraticCurveTo(110,14,106,52);
  x.quadraticCurveTo(96,34,77,34);x.quadraticCurveTo(58,34,48,52);x.closePath();x.fill();
  x.strokeStyle='rgba(150,143,120,.6)';x.lineWidth=2;
  x.beginPath();x.moveTo(56,44);x.quadraticCurveTo(77,26,100,44);x.stroke();
  x.beginPath();x.moveTo(60,34);x.quadraticCurveTo(77,20,96,34);x.stroke();
  x.restore();
  ell(x,104,44,8,7,'#e9e4d4');
  return c;
}
function villainCanvas(){
  const c=C(150,210),x=c.getContext('2d');
  const SKINd='#b47f52',SKINh='#e8bb8d',SUIT='#1c1a20',SUITh='#33303a',WIG='#241d18',WIGh='#3a2e24';
  ell(x,75,204,38,8,'rgba(0,0,0,.35)');
  rr(x,58,158,16,44,4,'#131218'); rr(x,78,158,16,44,4,'#131218');
  rr(x,54,196,24,12,4,'#0d0d10'); rr(x,74,196,24,12,4,'#0d0d10');
  rr(x,50,110,52,54,8,SUIT); rr(x,50,110,52,10,8,SUITh);
  rr(x,68,112,16,52,3,'#efe9df'); rr(x,73,112,6,40,2,'#6a3fa0');
  rr(x,58,116,10,46,4,SUITh); rr(x,84,116,10,46,4,SUITh);
  rr(x,40,116,16,42,6,SUIT); rr(x,96,116,16,40,6,SUIT);
  shade(x,48,158,10,10,SKINh,SKINd); shade(x,104,152,10,10,SKINh,SKINd);
  rr(x,96,138,34,16,5,'#e8c000'); rr(x,96,138,34,5,5,'#fff06a');
  rr(x,128,142,22,8,3,'#b9b9c2');
  for(let i=0;i<7;i++) rr(x,130+i*3,140,2,3,1,'#8a8a92');
  shade(x,76,86,24,27,SKINh,SKINd);
  ell(x,52,88,5,8,SKINd); ell(x,100,88,5,8,SKINd);
  ell(x,68,86,5,3,'#fff'); ell(x,86,86,5,3,'#fff');
  ell(x,68,86,2.5,2.5,'#241811'); ell(x,86,86,2.5,2.5,'#241811');
  rr(x,62,80,12,3,1,'#241811'); rr(x,80,80,12,3,1,'#241811');
  rr(x,68,98,16,3,2,'#7a3b34');
  x.fillStyle=WIG;
  x.beginPath();x.moveTo(50,88);x.quadraticCurveTo(40,40,76,36);x.quadraticCurveTo(112,40,102,88);
  x.quadraticCurveTo(96,60,76,58);x.quadraticCurveTo(56,60,50,88);x.closePath();x.fill();
  ell(x,76,52,30,20,WIG); ell(x,72,50,18,10,WIGh);
  rr(x,48,80,8,26,4,WIG); rr(x,96,80,8,26,4,WIG);
  ell(x,44,66,6,12,WIG,-.5); ell(x,110,66,6,12,WIG,.5); ell(x,76,34,7,10,WIG);
  return c;
}

/* séquito del Presidente: figura pequeña con túnica + turbante árabe */
function allyCanvas(robe, turb){
  const c=C(60,104), x=c.getContext('2d');
  const SKIN='#d59a6e', SKINd='#b0774d', ROBEd=robe.d, ROBE=robe.c, TURB=turb;
  ell(x,30,101,17,4,'rgba(0,0,0,.32)');
  // túnica larga (kaftán) con sombreado
  const rg=x.createLinearGradient(12,44,48,100); rg.addColorStop(0,ROBE); rg.addColorStop(1,ROBEd);
  x.fillStyle=rg; x.beginPath(); x.moveTo(19,46); x.lineTo(41,46); x.lineTo(48,100); x.lineTo(12,100); x.closePath(); x.fill();
  x.fillStyle=ROBEd; x.fillRect(28,48,3,52);
  rr(x,10,48,10,32,4,ROBE); rr(x,40,48,10,30,4,ROBE); // mangas
  shade(x,14,80,5,5,'#e6b487',SKINd); shade(x,46,78,5,5,'#e6b487',SKINd); // manos
  shade(x,30,33,13,15,'#e6b487',SKINd); // cabeza
  ell(x,30,44,11,7,'#2e2118'); // barba
  ell(x,26,33,1.8,1.8,'#201810'); ell(x,34,33,1.8,1.8,'#201810'); // ojos
  // turbante
  const tg=x.createLinearGradient(18,16,42,30); tg.addColorStop(0,TURB); tg.addColorStop(1,'#cfc7b2');
  x.fillStyle=tg; x.beginPath(); x.moveTo(18,31); x.quadraticCurveTo(16,15,30,14);
  x.quadraticCurveTo(44,15,42,31); x.quadraticCurveTo(36,23,30,23); x.quadraticCurveTo(24,23,18,31); x.closePath(); x.fill();
  return c;
}

/* ---------------- escena ---------------- */
class Fight extends Phaser.Scene {
  constructor(){ super('Fight'); }

  preload(){
    // sólo dibujos: NO se carga nada externo aquí, así el juego arranca siempre
    this.textures.addCanvas('hero', heroCanvas());
    this.textures.addCanvas('villain', villainCanvas());
    this.textures.addCanvas('ally1', allyCanvas({c:'#e8e2d2',d:'#cabf9f'}, '#f2ede0'));
    this.textures.addCanvas('ally2', allyCanvas({c:'#c9b48a',d:'#a98f63'}, '#e5ddc8'));
    this.textures.addCanvas('ally3', allyCanvas({c:'#b9a7d0',d:'#9784b0'}, '#efe9df'));
  }

  create(){
    wireButtons();
    this.drawStage();
    this.p1 = this.mkFighter(240, 'hero', 1, false);
    this.p2 = this.mkFighter(680, 'villain', -1, true);
    this.p1.foe = this.p2; this.p2.foe = this.p1;
    // colores de miembros: Presidente (camuflado) / Ex Presidente (traje)
    this.p1.skinCol=0xe6b487; this.p1.legCol=0x5b6338; this.p1.footCol=0x241d14;
    this.p2.skinCol=0xe8bb8d; this.p2.legCol=0x1c1a20; this.p2.footCol=0x0d0d10;
    this.hud = this.buildHUD();
    this.add.text(W-8, H-6, 'v4', {fontFamily:'Oswald',fontSize:'11px',color:'#6a5a3a'}).setOrigin(1,1).setDepth(80);
    this.winsP1 = 0; this.winsP2 = 0; this.roundNo = 0;
    this.startRound();
    // la foto real se carga aparte y se cambia sola cuando llega (nunca bloquea)
    this.loadHeroPhoto();
  }

  loadHeroPhoto(){
    if (this.textures.exists('presidente')) { this.applyHeroPhoto(); return; }
    this.load.image('presidente', 'assets/presidente.png');
    this.load.once('filecomplete-image-presidente', () => this.applyHeroPhoto());
    this.load.once('loaderror', () => { /* si falla, se queda el dibujo */ });
    this.load.start();
  }
  applyHeroPhoto(){
    // compone: cuerpo camuflado dibujado + cara REAL recortada en óvalo (sin fondo)
    const src = this.textures.get('presidente').getSourceImage();
    const comp = C(150,210), x = comp.getContext('2d');
    x.drawImage(heroCanvas(), 0, 0);                 // cuerpo camuflado + mate
    x.save();
    x.beginPath(); x.ellipse(76,46,45,60,0,0,7); x.clip();  // óvalo cabeza (elimina el fondo del tapiz)
    x.drawImage(src, 45,18, 210,360, 29,-18, 94,132);       // cabeza real (turbante+cara+barba)
    x.restore();
    if (this.textures.exists('presidente_comp')) this.textures.remove('presidente_comp');
    this.textures.addCanvas('presidente_comp', comp);
    const s = this.p1.sprite;
    s.setTexture('presidente_comp');
    this.p1.base = 215 / s.height;
    s.setScale(this.p1.base);
    s.setFlipX(this.p1.facing < 0);
  }

  drawStage(){
    const g = this.add.graphics();
    g.fillGradientStyle(0x2a2018,0x2a2018,0x140f0a,0x140f0a,1); g.fillRect(0,0,W,GROUND);
    const tx=W/2-260, tw=520, ty=40, th=300;
    g.fillStyle(0x6b4a2c,1); g.fillRect(tx-6,ty-6,tw+12,th+12);
    g.fillStyle(0x4a3a5a,1); g.fillRect(tx,ty,tw,th);
    g.fillStyle(0x7a5a3a,.5);
    for(let i=0;i<8;i++) for(let j=0;j<5;j++) g.fillRect(tx+20+i*62,ty+24+j*58,40,38);
    g.fillStyle(0x8a6a9a,.35);
    for(let i=0;i<8;i++) for(let j=0;j<5;j++) g.fillRect(tx+30+i*62,ty+34+j*58,20,18);
    const lg=this.add.graphics(); lg.fillStyle(0xffcf7a,.10); lg.fillRect(0,0,W,180);
    g.fillStyle(0x3a2a1c,1); g.fillRect(0,GROUND,W,H-GROUND);
    g.fillStyle(0x2c2015,1); for(let xx=0;xx<W;xx+=70) g.fillRect(xx,GROUND,4,H-GROUND);
    g.fillStyle(0x4a3626,1); g.fillRect(0,GROUND,W,6);
    const mg=this.add.graphics(); mg.fillStyle(0x111111,1);
    mg.fillRect(150,GROUND-4,4,-140); mg.fillRect(120,GROUND-140,64,6);
    mg.fillStyle(0x1a1a1a,1); mg.fillCircle(120,GROUND-150,14); mg.fillStyle(0x333333,1); mg.fillCircle(120,GROUND-150,10);
    // séquito del Presidente (izquierda): figuras más pequeñas con túnica árabe
    [['ally2',48,.84],['ally1',98,.66],['ally3',152,.75]].forEach(([tex,ax,sc])=>{
      this.add.image(ax,GROUND-2,tex).setOrigin(.5,1).setScale(sc);
    });
    const v=this.add.graphics(); v.setDepth(40);
    for(let i=0;i<6;i++){ v.fillStyle(0x000000,.06); v.fillRect(i*6,i*6,W-i*12,H-i*12); }
  }

  mkFighter(x,tex,facing){
    const s=this.add.image(x,GROUND,tex).setOrigin(.5,1);
    const base=215/s.height; s.setScale(base); s.setFlipX(facing<0);
    const limb=this.add.graphics().setDepth(1);   // pierna/brazo que se estira al golpear
    return {sprite:s,limb,base,hp:100,facing,vx:0,vy:0,onGround:true,state:'idle',stateT:0,cool:0,
      hitDone:false,attackKind:'punch',attackActive:false,block:false,stun:0,think:0,ko:false,active:false,
      skinCol:0xe6b487,legCol:0x5b6338,footCol:0x241d14};
  }

  drawLimb(f){
    const g=f.limb; g.clear();
    if(f.state!=='attack' || !f.attackActive) return;
    const s=f.sprite, dir=f.facing, kick=(f.attackKind==='kick');
    const y=s.y-(kick?48:96), length=kick?78:56, th=kick?17:12;
    const startX=s.x+dir*8, endX=startX+dir*length;
    g.fillStyle(kick?f.legCol:f.skinCol,1);
    g.fillRect(Math.min(startX,endX), y-th/2, length, th);           // pierna o brazo
    g.fillStyle(kick?f.footCol:f.skinCol,1);
    g.fillCircle(endX, y, kick?11:9);                                // borceguí / puño
  }

  buildHUD(){
    const mk=(x,align,col)=>{
      this.add.rectangle(x,36,378,26,0x120d08).setOrigin(align,.5).setStrokeStyle(2,0x4a3a26).setDepth(60);
      const bar=this.add.rectangle(x+(align?-3:3),36,372,18,col).setOrigin(align,.5).setDepth(61);
      return {bar,full:372};
    };
    const l=mk(28,0,0x8fb14a), r=mk(W-28,1,0xe0b23a);
    this.add.text(30,54,'EL PRESIDENTE',{fontFamily:'Oswald',fontSize:'15px',color:'#cfe08a'}).setDepth(61);
    this.add.text(W-30,54,'EL EX PRESIDENTE',{fontFamily:'Oswald',fontSize:'15px',color:'#e0b23a'}).setOrigin(1,0).setDepth(61);
    this.pips=this.add.text(W/2,22,'',{fontFamily:'Oswald',fontSize:'16px',color:'#efe6d6'}).setOrigin(.5).setDepth(61);
    this.center=this.add.text(W/2,H/2-30,'',{fontFamily:'Special Elite',fontSize:'40px',color:'#e0432a',
      stroke:'#000',strokeThickness:5,align:'center'}).setOrigin(.5).setDepth(70);
    return {l,r};
  }

  startRound(){
    this.roundNo++;
    this.p1.hp=this.p2.hp=100; this.p1.ko=this.p2.ko=false;
    this.p1.sprite.x=240; this.p2.sprite.x=680; this.p1.sprite.y=this.p2.sprite.y=GROUND;
    this.p1.vy=this.p2.vy=this.p1.vx=this.p2.vx=0; this.p1.facing=1; this.p2.facing=-1;
    this.roundOver=false; this.matchOver=false; this.p1.active=this.p2.active=false;
    this.pips.setText('★'.repeat(this.winsP1)+'   ROUND '+this.roundNo+'   '+'★'.repeat(this.winsP2));
    this.center.setColor('#e8c15a').setFontSize(40).setText('ROUND '+this.roundNo);
    this.time.delayedCall(900,()=>{
      this.center.setColor('#e0432a').setText('¡PELEEN!'); this.p1.active=this.p2.active=true; Sfx.fight();
      this.time.delayedCall(700,()=>{ if(!this.roundOver) this.center.setText(''); });
    });
  }

  tryAttack(f,kind){
    if(f.cool>0||f.stun>0||!f.onGround||f.state==='attack'||!f.active) return;
    f.state='attack'; f.attackKind=kind; f.hitDone=false;
    f.stateT=kind==='kick'?320:240; f.cool=kind==='kick'?520:360;
  }
  attackHitbox(f){ const s=f.sprite,reach=f.attackKind==='kick'?76:60;
    const x=f.facing>0?s.x+24:s.x-24-reach; return new Phaser.Geom.Rectangle(x,s.y-125,reach,52); }
  bodyRect(f){ const s=f.sprite; return new Phaser.Geom.Rectangle(s.x-28,s.y-165,56,160); }

  hurt(t,a,dmg,kb){
    if(t.block){dmg=Math.ceil(dmg*.25);kb*=.4; Sfx.block();}
    else { a.attackKind==='kick' ? Sfx.kick() : Sfx.hit(); }
    t.hp=Math.max(0,t.hp-dmg); t.vx=a.facing*kb; t.stun=t.block?120:300;
    t.sprite.setTint(0xff7766); this.time.delayedCall(120,()=>t.sprite.clearTint());
    if(t.hp<=0&&!this.roundOver) this.endRound(t);
  }
  endRound(loser){
    this.roundOver=true; loser.ko=true; this.p1.active=this.p2.active=false;
    const winner=loser===this.p1?this.p2:this.p1;
    if(winner===this.p1)this.winsP1++;else this.winsP2++;
    this.center.setColor('#e0432a').setFontSize(46).setText('¡K.O.!'); Sfx.ko();
    this.pips.setText('★'.repeat(this.winsP1)+'   ROUND '+this.roundNo+'   '+'★'.repeat(this.winsP2));
    this.time.delayedCall(1300,()=>{
      if(this.winsP1>=2||this.winsP2>=2){
        this.matchOver=true;
        const msg=this.winsP1>=2?'GANA EL PRESIDENTE\n\nse gana pensando en el otro':'GANA EL EX PRESIDENTE';
        this.center.setColor(this.winsP1>=2?'#8fd14f':'#e0b23a').setFontSize(26).setText(msg+'\n\nENTER = revancha');
      } else this.startRound();
    });
  }

  update(t,delta){
    const dt=delta/1000;
    if(this.matchOver){ this.p1.limb.clear(); this.p2.limb.clear(); if(input.enter){input.enter=false;this.winsP1=this.winsP2=0;this.roundNo=0;this.startRound();} return; }
    input.enter=false;
    this.step(this.p1,dt,true); this.step(this.p2,dt,false);
    this.resolve(); this.updateHUD();
  }
  step(f,dt,isPlayer){
    const s=f.sprite; f.facing=(f.foe.sprite.x>=s.x)?1:-1; s.setFlipX(f.facing<0); f.block=false;
    if(f.stun>0) f.stun-=dt*1000;
    else if(f.active){ if(isPlayer)this.playerInput(f); else this.cpuInput(f,dt); }
    if(f.cool>0) f.cool-=dt*1000;
    if(f.state==='attack'){
      f.stateT-=dt*1000;
      const act=f.attackKind==='kick'?(f.stateT<210&&f.stateT>90):(f.stateT<170&&f.stateT>70);
      f.attackActive=act; if(act) f.vx=f.facing*160;
      if(f.stateT<=0){f.state='idle';f.attackActive=false;}
    }
    f.vy+=GRAV*dt; s.x+=f.vx*dt; s.y+=f.vy*dt; f.vx*=(f.onGround?.80:.94); if(Math.abs(f.vx)<4)f.vx=0;
    if(s.y>=GROUND){s.y=GROUND;f.vy=0;f.onGround=true;} else f.onGround=false;
    s.x=Phaser.Math.Clamp(s.x,50,W-50);
    s.setAngle(f.state==='attack'&&f.attackActive?f.facing*7:0);
    s.setScale(f.base, f.block?f.base*.9:f.base);
    this.drawLimb(f);
  }
  playerInput(f){
    if(input.down&&f.onGround) f.block=true;
    else{ if(input.left)f.vx=-260; if(input.right)f.vx=260; if(input.jump&&f.onGround){f.vy=-600;f.onGround=false;Sfx.jump();} }
    input.jump=false;
    if(input.punch){ this.tryAttack(f,'punch'); input.punch=false; }
    if(input.kick){ this.tryAttack(f,'kick'); input.kick=false; }
  }
  cpuInput(f,dt){
    const d=f.foe.sprite.x-f.sprite.x, ad=Math.abs(d); f.think-=dt*1000;
    if(f.foe.state==='attack'&&ad<100&&Math.random()<.15){f.block=true;return;}
    if(ad>95)f.vx=Math.sign(d)*230; else if(ad<58)f.vx=-Math.sign(d)*180;
    if(f.think<=0){ f.think=Phaser.Math.Between(300,700);
      if(ad<86&&f.onGround)this.tryAttack(f,Math.random()<.5?'punch':'kick');
      else if(Math.random()<.15&&f.onGround){f.vy=-560;f.onGround=false;} }
  }
  resolve(){
    [[this.p1,this.p2],[this.p2,this.p1]].forEach(([a,d])=>{
      if(a.state==='attack'&&a.attackActive&&!a.hitDone){
        if(Phaser.Geom.Intersects.RectangleToRectangle(this.attackHitbox(a),this.bodyRect(d))){
          a.hitDone=true; this.hurt(d,a,a.attackKind==='kick'?13:8,a.attackKind==='kick'?320:220);
        }
      }
    });
  }
  updateHUD(){ this.hud.l.bar.width=this.hud.l.full*(this.p1.hp/100); this.hud.r.bar.width=this.hud.r.full*(this.p2.hp/100); }
}

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0d0b0a',
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,            // escala manteniendo proporción
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H
  },
  scene: [Fight]
});

// re-escalar al girar el teléfono / redimensionar
['resize','orientationchange'].forEach(ev =>
  window.addEventListener(ev, () => setTimeout(() => {
    if (window.game && window.game.scale) window.game.scale.refresh();
  }, 200))
);
