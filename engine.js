
'use strict';

/* =====================================================================
   NIVEAU 1 — moteur de niveau scrollant
   Architecture en blocs detachables :
     [NOYAU]        canvas, physique, boucle (commun aux sandbox)
     [BAPTISTE]     sprite — A RETIRER pour brancher le sandbox perso
     [MONSTRES]     sprites + IA — A RELIER au sandbox monstres
     [NIVEAU]       parsing JSON, camera, mecaniques propres au niveau
   Echelle : 1 tuile = 16 px. Monde Y descendant ; le JSON est en
   Y montant et converti au chargement (voir buildLevel()).
===================================================================== */

/* ── [NOYAU] Canvas ─────────────────────────────────────────────── */
const TILE = 16;
const VIEW_TILES_H = 16;            // 256px de haut (16 tuiles) — toute la hauteur du monde
const H = VIEW_TILES_H * TILE;      // 256 — hauteur logique (fixe)
// Largeur logique variable : on remplit toute la fenêtre sans déformer en
// montrant une largeur de monde adaptée au ratio de l'écran. Bornée pour
// éviter une vue absurde sur écran très étroit ou ultra-large.
let W = 28 * TILE;                  // valeur initiale (~448px), recalculée par resize()
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
let S = 1;
function resize(){
  const uw = window.innerWidth, uh = window.innerHeight;
  S = uh / H;                       // échelle fixée par la hauteur (vue = toute la hauteur du monde)
  // largeur logique nécessaire pour couvrir la fenêtre, arrondie à la tuile SUPÉRIEURE
  // (ceil) pour ne jamais laisser de bande, bornée pour rester jouable.
  let wTiles = Math.ceil((uw / S) / TILE);
  wTiles = Math.max(24, Math.min(48, wTiles));
  W = wTiles * TILE;
  // le canvas occupe exactement la fenêtre ; le décor logique est >= large, donc plein écran.
  canvas.width = uw; canvas.height = uh;
  S = uh / H;                       // S reste calé sur la hauteur ; W est >= uw/S
}
resize();
window.addEventListener('resize', resize);

/* ── [NOYAU] Physique de Baptiste (reprise sandbox) ─────────────── */
// Physique dérivée du personnage sélectionné (défini par index.html)
const SELECTED_CID = window.SELECTED_CID || 1;
const charDef = CHARS[SELECTED_CID];
const PHYS = Object.assign({}, charDef.phys);
const PLAYER_H = charDef.drawH, PLAYER_H_CR = charDef.drawHcr, PLAYER_W = 20;

/* Trampoline : la hauteur monte avec le CARRE de la vitesse.
   Saut normal ~5.7 tuiles ; cible ~13 tuiles -> ratio vitesse = sqrt(13/5.7) ~1.5 */
const TRAMPO_FORCE = PHYS.jumpForce * 1.6;   // ~-8.48 -> ~14.5 tuiles, marge confortable

/* ── [NOYAU] Etat joueur ────────────────────────────────────────── */
const p = { x:0, y:0, w:PLAYER_W, h:PLAYER_H, vx:0, vy:0,
            onGround:false, facing:1, crouching:false,
            coyote:0, jumpBuf:0, walkFrame:0, walkTick:0,
            dead:false, respawnT:0 };
let spawnX = 0, spawnY = 0;

/* ── [POUVOIRS] État (repris du sandbox perso, adapté au niveau) ── */
const dash  = {active:false,timer:0,cooldown:0,dx:0,dy:0,trail:[]};
const djump = {used:false, smokeParticles:[]};
const balls = []; let ballCd = 0;
let armorHP = 0, armorFlash = 0;
const giant = {active:false,timer:0,charges:0,flashTick:0,invincible:0};

function initPowers(){
  dash.active=false; dash.timer=0; dash.cooldown=0; dash.trail=[];
  djump.used=false; djump.smokeParticles.length=0;
  balls.length=0; ballCd=0;
  armorHP = charDef.hasArmor ? charDef.armorMax : 0; armorFlash=0;
  giant.active=false; giant.timer=0; giant.invincible=0; giant.flashTick=0;
  giant.charges = charDef.hasGiant ? charDef.giantCharges : 0;
}

function triggerDash(){
  const left=keys['ArrowLeft']||keys['KeyA'], right=keys['ArrowRight']||keys['KeyD'];
  // Dash strictement horizontal : la direction suit la flèche tenue,
  // sinon le sens du regard. Les touches haut/bas n'ont aucun effet sur le dash.
  dash.dx = right?1:left?-1:p.facing;
  dash.dy = 0;
  dash.active=true; dash.timer=charDef.dashDuration; dash.trail=[]; p.vy=0;
}
function shootBall(){
  ballCd=charDef.fireballCooldown||120;
  balls.push({x:p.x+p.w/2,y:p.y+p.h*0.35,vx:(charDef.ballVx||3.6)*p.facing,vy:-(charDef.ballVy||2.3),life:300,r:5});
}
function activateGiant(){
  giant.active=true; giant.timer=charDef.giantDuration; giant.charges--; giant.invincible=300;
  const nh=Math.round(charDef.drawH*1.5); p.y-=(nh-p.h); p.h=nh; p.w=Math.round(20*1.5);
  PHYS.runMax=charDef.phys.runMax*1.5; PHYS.accel=charDef.phys.accel*1.5; PHYS.airAccel=charDef.phys.airAccel*1.5;
}

/* ── [NOYAU] Clavier ────────────────────────────────────────────── */
const keys = {};
let jumpJP = false;
window.addEventListener('keydown', e => {
  if(!keys[e.code] && (e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW')) jumpJP = true;
  // Double saut (Timothée)
  if((e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW') && charDef.hasDoubleJump && !p.onGround && !djump.used && !p.dead){
    djump.used=true; p.vy=PHYS.jumpForce;
    for(let i=0;i<8;i++) djump.smokeParticles.push({x:p.x+p.w/2,y:p.y+p.h,vx:(Math.random()-.5)*2,vy:-Math.random()*1.5,life:18,a:1});
  }
  // Pouvoir [F]
  if(e.code==='KeyF' && !p.dead){
    if(charDef.hasDash && !dash.active && dash.cooldown===0) triggerDash();
    else if(charDef.hasFireball && ballCd===0) shootBall();
    else if(charDef.hasGiant && !giant.active && giant.charges>0) activateGiant();
  }
  keys[e.code] = true;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if(e.code==='KeyR') restartLevel();
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
  if((e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW') && p.vy < PHYS.jumpCutoff) p.vy = PHYS.jumpCutoff;
});

/* ── [NIVEAU] Donnees brutes embarquees ─────────────────────────── */
// LEVEL fourni par level1.js (window.LEVEL)
const LEVEL = window.LEVEL;
const WORLD_TILES_H = VIEW_TILES_H;                 // hauteur de monde = vue
const WORLD_W = LEVEL.longueur * TILE;              // largeur monde en px
const GROUND_Y = WORLD_TILES_H * TILE;              // y du bas du monde (sous le sol)
const GROUND_SURFACE = GROUND_Y - 2 * TILE;         // y de la SURFACE du sol (épaisseur 2 tuiles)

/* Conversion : le JSON est en Y montant (y=0 en bas).
   y_px_haut_du_bloc = (WORLD_TILES_H - (y + h)) * TILE                  */
function tileToPx(el){
  return {
    x: el.x * TILE,
    y: (WORLD_TILES_H - (el.y + el.h)) * TILE,
    w: el.w * TILE,
    h: el.h * TILE
  };
}

/* Collections de monde (remplies par buildLevel) */
let solids = [];        // {x,y,w,h}  collision pleine (sol, blocs solides, tuyaux)
let platforms = [];     // {x,y,w,h}  collision par le dessus uniquement
let spikes = [];        // {x,y,w,h}  mortel au contact
let breakables = [];    // {x,y,w,h,alive}  blocs fissures/briques (cassables tete)
let movers = [];        // plateformes mobiles
let fallers = [];       // blocs tombants
let trampolines = [];   // {x,y,w,h,hidden,revealBlock}
let coins = [];         // les 3 pieces-recompense {x,y,w,h,taken,cond,id}
let enemies = [];       // monstres typés (compatibles sandbox)
let monsterProjectiles = [];
let decoItems = [];     // decor sans collision
let flag = null, castle = null;
let dragonsKilled = {};  // suivi pour pieces dragon
let coinCount = 0;
let levelDone = false;
let runFrames = 0;        // chrono du run en cours (frames)
let runActive = false;    // le chrono tourne-t-il ?
const FPS = 60;
let secretCoin = null;        // pièce secrète (hors décompte) zone 22
let secretCoinTaken = false;  // collectée ?
let totalEnemies = 0;         // ennemis au départ (pour la pièce secrète)
let enemiesKilled = 0;        // ennemis tués cumulés

/* ── [NIVEAU] Construction depuis le JSON ───────────────────────── */
function buildLevel(){
  solids=[]; platforms=[]; spikes=[]; breakables=[]; movers=[];
  fallers=[]; trampolines=[]; coins=[]; enemies=[]; monsterProjectiles=[];
  decoItems=[]; flag=null; castle=null; dragonsKilled={}; coinCount=0; levelDone=false;
  secretCoin=null; secretCoinTaken=false; enemiesKilled=0;

  // Decor de fond
  for(const d of LEVEL.decor){ const r=tileToPx(d); decoItems.push({type:d.type, ...r, plan:d.plan}); }

  for(const z of LEVEL.zones){
    for(const el of z.elements){
      if(el.w===0||el.h===0) continue;        // elements nuls (commentaires)
      const r = tileToPx(el);
      switch(el.type){
        case 'spawn_joueur':
          spawnX = r.x; spawnY = r.y - (PLAYER_H - TILE);  // poser au sol
          break;
        case 'sol':
        case 'bloc_solide':
          solids.push(r); break;
        case 'tuyau':
          solids.push({...r, pipe:true}); break;
        case 'trou':
          break; // absence de sol = trou, rien a poser
        case 'plateforme_suspendue':
          platforms.push({...r, texture: el.texture||null}); break;
        case 'bloc_brique':
        case 'bloc_fissure':
          // cassables, sans contenu (decision : pas de pieces de parcours)
          breakables.push({...r, alive:true}); break;
        case 'pics':
          spikes.push(r); break;
        case 'trampoline':
          // un seul trampoline effectif par position ; si un bloc_fissure
          // 'trampoline' partage la position, on le masque derriere un bloc
          trampolines.push({...r, hidden:false});
          break;
        case 'plateforme_mobile': {
          const mv = {...r, vx:0, vy:0, axis: el.mouvement, baseX:r.x, baseY:r.y};
          const spd = parseVm(el.vitesse);
          if(el.mouvement==='horizontal'){
            mv.min = el.amplitude_tuiles[0]*TILE;
            mv.max = el.amplitude_tuiles[1]*TILE;
            mv.vx = spd * (el.dephasage? -1 : 1);
          } else {
            // vertical : amplitude en Y tuiles (montant) -> px
            const a = el.amplitude_tuiles_y;
            mv.minY = (WORLD_TILES_H - a[1] - el.h) * TILE;
            mv.maxY = (WORLD_TILES_H - a[0] - el.h) * TILE;
            mv.vy = spd * (el.dephasage? -1 : 1);
            mv.y = mv.minY;
          }
          movers.push(mv); break;
        }
        case 'bloc_tombant':
          fallers.push({...r, baseY:r.y, state:'idle', timer:0, vy:0}); break;
        case 'piece_recompense':
          coins.push({...r, taken:false, cond:el.condition||'', id:el.id}); break;
        case 'piece_secrete':
          secretCoin = {...r, taken:false, revealed:false, id:el.id}; break;
        case 'ennemi_1': spawnEnemy('walker', r, el); break;
        case 'ennemi_2': spawnEnemy('flyer',  r, el); break;
        case 'ennemi_3': spawnEnemy('caster', r, el); break;
        case 'mat_drapeau':
          flag = {...r, raised:false}; break;
        case 'chateau':
          castle = r; break;
        case 'alcove_secrete':
          decoItems.push({type:'alcove', ...r, plan:'secret'}); break;
        default: break;
      }
    }
  }

  augmentLevel();   // [AUGMENT] trampoline zone 5 + secret zone 10 — retirable d'un bloc
  totalEnemies = enemies.filter(e=>e._type).length;
}

/* =====================================================================
   [AUGMENT] Couche de densification — AJOUTS hors JSON d'origine.
   Règles :
   - plateformes espacées HORIZONTALEMENT, jamais empilées au même X ;
   - une seule hauteur par tronçon, gap net entre deux plateformes ;
   - ZONE 5 laissée libre de toute plateforme (trampoline = seule voie) ;
   - le trampoline caché zone 5 est remonté pour être cassable par-dessous.
   >>> Pour revenir au JSON pur : supprimer augmentLevel(). <<<
   Coordonnées en TUILES (Y montant).
===================================================================== */
function augmentLevel(){
  // Les plateformes/murs de densification sont désormais intégrés directement
  // dans les données de zone (LEVEL). Cette couche ne gère plus que les deux
  // mécaniques spéciales : trampoline caché (zone 5) et secret accroupi (zone 10).
  fixZone5Trampoline();
  fixZone10Secret();
}

/* Zone 10 — mur SECRET plus BAS et plus LARGE, sans aucun indice. Deux
   plateformes AVANT permettent de passer par-dessus. La pièce est invisible,
   cachée derrière la texture ; on l'atteint en s'accroupissant sous le mur. */
function fixZone10Secret(){
  const zx = (LEVEL.zones.find(z=>z._secret_x!=null)||{})._secret_x;
  if(zx==null) return;
  const wx = zx*TILE;
  const surf = GROUND_SURFACE;     // 224
  const GAP  = 24;                 // ouverture accroupie (20<GAP<32)
  const ww   = TILE;
  // Mur BAS : sommet à tile y=5 (py=144) -> ~5 tuiles de haut seulement, franchissable
  // par-dessus depuis les plateformes. Largeur 4 tuiles (plus large).
  const topY = 144;                // sommet du mur (≈5 tuiles au-dessus du sol)
  const widthT = 4;                // largeur totale du bloc de pierre
  // façade avant (sous laquelle on s'accroupit) : pleine de topY à (surf-GAP)
  solids.push({ x:wx, y:topY, w:ww, h:(surf-GAP)-topY, secretWall:true });
  // remplissage du dessus sur toute la largeur (masse de pierre uniforme)
  solids.push({ x:wx+ww, y:topY, w:(widthT-2)*TILE, h:(surf-GAP)-topY, secretWall:true, fillTop:true });
  // paroi arrière : pleine jusqu'au sol, ferme la poche
  const backX = wx + (widthT-1)*TILE;
  solids.push({ x:backX, y:topY, w:ww, h:surf-topY, secretWall:true });
  // BOUCHON de l'ouverture : ferme les 24px du bas, SAUF si le joueur est
  // réellement accroupi ou s'il est "lowProfile" (Timothé). La collision
  // ignore ce solide dans ces deux cas (voir collideSolidsX/Y).
  solids.push({ x:wx, y:surf-GAP, w:ww, h:GAP, secretWall:true, crouchGate:true, noDraw:true });

  // Deux plateformes AVANT le mur, espacées, pour passer par-dessus (sommet 5 t).
  platforms.push(tileToPx({x:zx-6,y:4,w:2,h:1}));
  platforms.push(tileToPx({x:zx-3,y:6,w:2,h:1}));

  // Pièce 2/3 INVISIBLE, cachée dans la poche basse derrière la texture.
  for(const c of coins){
    if(c.id===202){ c.x = wx+ww+(TILE/2); c.y = surf-GAP; c.w = TILE; c.h = GAP; c.hiddenCoin=true; }
  }
}

/* Zone 5 — caisse flottant haut ; cassée, révèle un trampoline au sol menant
   à une plateforme récompense TRÈS HAUTE (hors champ, invisible au saut),
   avec la pièce posée AU-DESSUS de la plateforme. */
function fixZone5Trampoline(){
  const zx = (LEVEL.zones.find(z=>z._tramp_x!=null)||{})._tramp_x;
  if(zx==null) return;
  const TX = zx;
  const cover = {...tileToPx({x:TX,y:5,w:1,h:1}), alive:true, isTrampoCover:true};
  breakables.push(cover);
  const trGround = tileToPx({x:TX,y:2,w:1,h:1});
  trampolines.push({...trGround, hidden:true, cover, peek:false, dropFromCover:true});
  // plateforme récompense TRÈS HAUTE : tile y=13 (≈12 t au-dessus du sol),
  // hors de vue, atteinte seulement par le trampoline (apex ~14.5 t > 12).
  platforms.push(tileToPx({x:TX-2,y:13,w:5,h:1}));
  // pièce AU-DESSUS de la plateforme (tile y=14)
  for(const c of coins){
    if(c.id===200){ c.x=(TX)*TILE; c.y=tileToPx({x:TX,y:14,w:1,h:1}).y; c.w=TILE; c.h=TILE; }
  }
}

function parseVm(s){
  // "0.6x Vm" -> fraction * runMax
  if(!s) return PHYS.runMax*0.5;
  const m = (''+s).match(/([\d.]+)/);
  const f = m? parseFloat(m[1]) : 0.5;
  return PHYS.runMax * f;
}

/* ── [MONSTRES] Spawn typé (compatible sandbox monstres) ────────── */
function spawnEnemy(type, r, el){
  const footY = r.y + TILE;            // surface d'appui en px
  // Bornes de zone : l'ennemi reste confiné entre zMin et zMax (en px).
  const zMin = el.zone_min!=null ? el.zone_min*TILE : 0;
  const zMax = el.zone_max!=null ? el.zone_max*TILE : WORLD_W;
  if(type==='walker'){
    enemies.push({ _type:'walker', x:r.x, y:footY - 24, w:24, h:24,
      vx:parseVm(el.vitesse) * (el.sens_initial==='gauche'?-1:1),
      patrol:true, alive:true, frame:0, tick:0, zMin, zMax });
  }
  else if(type==='flyer'){
    const by = r.y;
    enemies.push({ _type:'flyer', x:r.x, y:by, w:28, h:20, baseY:by,
      hspeed:parseVm(el.vitesse)*(Math.random()<0.5?1:-1),
      ampY:28, oscSpeed:0.055,
      phase:Math.random()*Math.PI*2, alive:true, frame:0, tick:0, zMin, zMax });
  }
  else if(type==='caster'){
    enemies.push({ _type:'caster', x:r.x, y:footY - 48, w:32, h:48,
      facing: -1, fireTimer:0, fireRate:160, projSpeed:1.4, fireCount:0,
      alive:true, frame:0, tick:0, _dragonId:el.id, zMin, zMax,
      _aerial: !!el._dragon_aerien, _givesCoin: !!el._dragon_aerien });
  }
}

/* ── [NIVEAU] Camera ────────────────────────────────────────────── */
let camX = 0;
function updateCamera(){
  // suit le joueur, centré-gauche ; back-scroll AUTORISÉ
  let target = p.x - W*0.4;
  target = Math.max(0, Math.min(target, WORLD_W - W));
  camX += (target - camX) * 0.18;
  if(Math.abs(target-camX) < 0.5) camX = target;
}

/* ── [NIVEAU] Collisions utilitaires ────────────────────────────── */
function aabb(ax,ay,aw,ah,bx,by,bw,bh){
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}

/* Tous les solides actuellement actifs (statiques + cassables vivants + tombants posés + movers) */
// Un "crouchGate" (bouchon de l'ouverture secrète) ne bloque PAS le joueur
// s'il est réellement accroupi, ou s'il est lowProfile (Timothé passe debout).
function gateBlocks(s){
  if(!s.crouchGate) return true;
  if(p.crouching) return false;
  if(charDef.lowProfile) return false;
  return true;
}

function collideSolidsX(){
  for(const s of solids){
    if(!gateBlocks(s)) continue;
    if(aabb(p.x,p.y,p.w,p.h,s.x,s.y,s.w,s.h)){
      if(p.vx>0) p.x = s.x - p.w;
      else if(p.vx<0) p.x = s.x + s.w;
      p.vx = 0;
    }
  }
  for(const b of breakables){
    if(!b.alive) continue;
    if(aabb(p.x,p.y,p.w,p.h,b.x,b.y,b.w,b.h)){
      if(p.vx>0) p.x = b.x - p.w;
      else if(p.vx<0) p.x = b.x + b.w;
      p.vx = 0;
    }
  }
}

function collideSolidsY(){
  p.onGround = false;
  // sol des tuiles + blocs solides + tuyaux
  for(const s of solids){
    if(!gateBlocks(s)) continue;
    if(aabb(p.x,p.y,p.w,p.h,s.x,s.y,s.w,s.h)){
      if(p.vy>=0 && (p.y+p.h - p.vy) <= s.y+1){ p.y = s.y - p.h; p.vy=0; p.onGround=true; }
      else if(p.vy<0 && (p.y - p.vy) >= s.y+s.h-1){ p.y = s.y+s.h; p.vy=0; }
    }
  }
  // plateformes suspendues (par le dessus)
  for(const pf of platforms){
    if(p.vy>=0 && aabb(p.x,p.y,p.w,p.h,pf.x,pf.y,pf.w,pf.h)
       && (p.y+p.h - p.vy) <= pf.y+2){ p.y = pf.y - p.h; p.vy=0; p.onGround=true; }
  }
  // blocs cassables : appui dessus + tete dessous
  for(const b of breakables){
    if(!b.alive) continue;
    if(aabb(p.x,p.y,p.w,p.h,b.x,b.y,b.w,b.h)){
      if(p.vy<0 && (p.y - p.vy) >= b.y+b.h-1){ // frappe par en dessous -> casse
        b.alive = false; p.vy = 1;
      } else if(p.vy>=0 && (p.y+p.h - p.vy) <= b.y+1){ p.y = b.y - p.h; p.vy=0; p.onGround=true; }
    }
  }
  // blocs tombants : appui dessus déclenche la chute
  for(const f of fallers){
    if(f.state==='gone') continue;
    if(p.vy>=0 && aabb(p.x,p.y,p.w,p.h,f.x,f.y,f.w,f.h) && (p.y+p.h - p.vy) <= f.y+2){
      p.y = f.y - p.h; p.vy=0; p.onGround=true;
      if(f.state==='idle'){ f.state='shaking'; f.timer=30; }   // ~0.5s
    }
  }
  // plateformes mobiles : appui dessus (et on suit le mouvement)
  for(const m of movers){
    if(p.vy>=0 && aabb(p.x,p.y,p.w,p.h,m.x,m.y,m.w,m.h) && (p.y+p.h - p.vy) <= m.y+3){
      p.y = m.y - p.h; p.vy=0; p.onGround=true;
      p.x += m.vx; // porté horizontalement
      if(m.axis==='vertical') p.y += m.vy;
    }
  }
}

/* ── [NIVEAU] Update mécaniques de niveau ───────────────────────── */
function updateMechanics(){
  // plateformes mobiles
  for(const m of movers){
    if(m.axis==='horizontal'){
      m.x += m.vx;
      if(m.x <= m.min){ m.x=m.min; m.vx*=-1; }
      if(m.x >= m.max){ m.x=m.max; m.vx*=-1; }
    } else {
      m.y += m.vy;
      if(m.y <= m.minY){ m.y=m.minY; m.vy*=-1; }
      if(m.y >= m.maxY){ m.y=m.maxY; m.vy*=-1; }
    }
  }
  // blocs tombants
  for(const f of fallers){
    if(f.state==='shaking'){ if(--f.timer<=0){ f.state='falling'; f.vy=0; } }
    else if(f.state==='falling'){ f.vy += 0.4; f.y += f.vy; if(f.y > GROUND_Y + 200) f.state='gone'; }
  }
}

/* ── [NIVEAU] Pièces, trampoline, pics, fin ─────────────────────── */
function checkLevelInteractions(){
  if(p.dead) return;
  // trampoline
  for(const t of trampolines){
    if(t.hidden){ if(t.cover && !t.cover.alive) t.hidden=false; else continue; }
    if(p.vy>=0 && aabb(p.x,p.y,p.w,p.h,t.x,t.y,t.w,t.h) && (p.y+p.h) <= t.y + t.h){
      p.y = t.y - p.h; p.vy = TRAMPO_FORCE; p.onGround=false;
      t.bounce = 8;
    }
    if(t.bounce>0) t.bounce--;
  }
  // pics — mortels (sauf Corentin, pieds endurcis : immunité aux pics)
  if(!charDef.spikeImmune){
    for(const s of spikes){
      if(aabb(p.x,p.y,p.w,p.h,s.x,s.y,s.w,s.h)){ killPlayer(); return; }
    }
  }
  // chute dans un trou (sous le monde)
  if(p.y > GROUND_Y + 40){ killPlayer(); return; }
  // pièces-récompense
  for(const c of coins){
    if(c.taken) continue;
    // la pièce du dragon n'est collectable qu'après sa mort
    if(c.cond && c.cond.indexOf('aerien')>=0 && !c._unlocked) continue;
    if(aabb(p.x,p.y,p.w,p.h,c.x,c.y,c.w,c.h)){ c.taken=true; coinCount++; }
  }
  // pièce secrète (hors décompte) : révélée si TOUS les ennemis sont tués
  if(secretCoin && !secretCoinTaken){
    if(!secretCoin.revealed && totalEnemies>0 && enemiesKilled>=totalEnemies) secretCoin.revealed=true;
    if(secretCoin.revealed && aabb(p.x,p.y,p.w,p.h,secretCoin.x,secretCoin.y,secretCoin.w,secretCoin.h)){
      secretCoinTaken=true;
    }
  }
  // arrivée : mât de drapeau
  if(flag && !levelDone && aabb(p.x,p.y,p.w,p.h,flag.x-6,flag.y,flag.w+12,flag.h)){
    flag.raised = true; levelDone = true; runActive = false;
    const timeMs = Math.round(runFrames / FPS * 1000);
    showEnd(timeMs);
    if(typeof window.onLevelComplete === 'function'){
      try { window.onLevelComplete(timeMs, SELECTED_CID, coinCount, secretCoinTaken); } catch(e){}
    }
  }
}

function killPlayer(){ if(!p.dead){ p.dead=true; p.respawnT=50; } }

/* Replacement du joueur au point de départ (sans toucher au monde) */
function placePlayer(){
  p.x=spawnX; p.y=spawnY; p.vx=0; p.vy=0; p.dead=false;
  p.crouching=false; p.w=20; p.h=PLAYER_H; p.onGround=false;
  // PHYS peut avoir été modifié par le géant : on le réinitialise depuis le perso
  PHYS.runMax=charDef.phys.runMax; PHYS.accel=charDef.phys.accel; PHYS.airAccel=charDef.phys.airAccel;
  initPowers();
}

/* Respawn après une mort : on REINITIALISE tout le niveau
   (ennemis, blocs cassés, blocs tombants, plateformes, pièces) puis on
   replace le joueur au début. Les pièces déjà prises sont remises. */
function respawn(){
  buildLevel();
  placePlayer();
  camX = 0;
  runFrames = 0; runActive = true;   // la mort relance le chrono du run
}

function restartLevel(){
  buildLevel();
  placePlayer();
  camX = 0;
  var _e=document.getElementById('end');_e.style.display='none';_e.classList.remove('show');
  levelDone = false;
  runFrames = 0; runActive = true;
}

function showEnd(timeMs){
  const te = document.getElementById('end-time');
  if(te) te.textContent = formatTime(timeMs);
  // canards obtenus : 3 emplacements, remplis selon coinCount ; +1 si secret
  const dd = document.getElementById('end-ducks');
  if(dd){
    let html='';
    for(let i=0;i<3;i++) html += '<img src="duck.svg" alt="" class="'+(i<coinCount?'got':'')+'">';
    if(secretCoinTaken) html += '<img src="duck.svg" alt="" class="got" title="Canard secret" style="filter:drop-shadow(0 0 6px var(--gold))">';
    dd.innerHTML = html;
  }
  const endEl = document.getElementById('end');
  endEl.style.display='flex'; endEl.classList.add('show');
}

/* mm:ss.cc */
function formatTime(ms){
  const t=Math.max(0,ms|0);
  const m=Math.floor(t/60000), s=Math.floor((t%60000)/1000), c=Math.floor((t%1000)/10);
  return (m>0? m+':' : '') + String(s).padStart(m>0?2:1,'0') + '.' + String(c).padStart(2,'0');
}
window.formatTime = formatTime;

/* ── [NOYAU] Update joueur (physique reprise sandbox) ───────────── */
function updatePlayer(){
  if(p.dead){ if(--p.respawnT<=0) respawn(); return; }
  const L=keys['ArrowLeft']||keys['KeyA'];
  const R=keys['ArrowRight']||keys['KeyD'];
  const dn=keys['ArrowDown']||keys['KeyS'];
  const jp=jumpJP; jumpJP=false;

  // ── DASH (Oscar) : mouvement prioritaire, stoppé par les murs (collision normale) ──
  if(dash.active){
    if(L) p.facing=-1; if(R) p.facing=1;
    p.vx = dash.dx*charDef.dashSpeed;
    p.vy = dash.dy*charDef.dashSpeed;
    dash.trail.push({x:p.x,y:p.y,w:p.w,h:p.h,a:1});
    if(dash.trail.length>8) dash.trail.shift();
    p.x += p.vx; collideSolidsX();   // s'arrête net contre un mur
    p.y += p.vy; collideSolidsY();
    if(p.x<0){p.x=0;} if(p.x+p.w>WORLD_W){p.x=WORLD_W-p.w;}
    if(--dash.timer<=0){ dash.active=false; dash.cooldown=charDef.dashCooldown; p.vx*=0.3; }
    updatePowerTimers();
    return;  // pas de physique normale pendant le dash
  }

  // Accroupi (Victor géant ne s'accroupit pas)
  const canCrouch = charDef.canCrouch!==false && !giant.active;
  if(dn && p.onGround && canCrouch){
    if(!p.crouching){ p.crouching=true; p.y+=(PLAYER_H-PLAYER_H_CR); p.h=PLAYER_H_CR; }
    p.vx *= 0.80;
  } else if(p.crouching){
    p.crouching=false; p.y-=(PLAYER_H-PLAYER_H_CR); p.h=(giant.active?Math.round(charDef.drawH*1.5):PLAYER_H);
  }
  // Horizontal
  if(p.onGround){
    if(L){ p.vx=Math.max(p.vx-PHYS.accel,-PHYS.runMax); }
    else if(R){ p.vx=Math.min(p.vx+PHYS.accel,PHYS.runMax); }
    else { if(Math.abs(p.vx)<=PHYS.decel) p.vx=0; else p.vx-=Math.sign(p.vx)*PHYS.decel; }
  } else {
    if(L){ p.vx=Math.max(p.vx-PHYS.airAccel,-PHYS.runMax); }
    else if(R){ p.vx=Math.min(p.vx+PHYS.airAccel,PHYS.runMax); }
    else { if(Math.abs(p.vx)<=PHYS.airDecel) p.vx=0; else p.vx-=Math.sign(p.vx)*PHYS.airDecel; }
  }
  if(L) p.facing=-1; if(R) p.facing=1;

  // Coyote + buffer
  if(p.onGround){ p.coyote=8; djump.used=false; } else if(p.coyote>0) p.coyote--;
  if(jp) p.jumpBuf=10; if(p.jumpBuf>0) p.jumpBuf--;
  if(p.jumpBuf>0 && p.coyote>0){ p.vy=PHYS.jumpForce; p.coyote=0; p.jumpBuf=0;
    if(p.crouching){p.crouching=false;p.h=PLAYER_H;} }

  // Gravité
  p.vy = Math.min(p.vy+PHYS.gravity, PHYS.fallMax);

  // Déplacement axe par axe + collisions
  p.x += p.vx; collideSolidsX();
  p.y += p.vy; collideSolidsY();

  // Bornes monde
  if(p.x<0){p.x=0;p.vx=0;}
  if(p.x+p.w>WORLD_W){p.x=WORLD_W-p.w;p.vx=0;}

  // Marche
  if(p.onGround && Math.abs(p.vx)>0.2){ if(++p.walkTick>9){p.walkTick=0;p.walkFrame=(p.walkFrame+1)%4;} }
  else p.walkFrame=0;

  updatePowerTimers();
}

/* ── [POUVOIRS] Mise à jour des compteurs, boules, géant, armure ── */
function updatePowerTimers(){
  // boules de feu (Matteo) : tuent tortues ET dragons à distance
  for(const b of balls){ b.vy+=0.07; b.x+=b.vx; b.y+=b.vy; b.life--;
    for(const e of enemies){ if(!e.alive||!e._type) continue;
      if(b.x>e.x && b.x<e.x+e.w && b.y>e.y && b.y<e.y+e.h){ killEnemy(e); b.life=0; break; } }
  }
  for(let i=balls.length-1;i>=0;i--) if(balls[i].life<=0) balls.splice(i,1);
  if(ballCd>0) ballCd--;
  // géant (Victor)
  if(giant.active){ giant.timer--; giant.flashTick++;
    if(giant.invincible>0) giant.invincible--;
    if(giant.timer<=0){
      giant.active=false; giant.invincible=0;
      const oh=p.h, nh=charDef.drawH; p.y+=(oh-nh); p.h=nh; p.w=20;
      PHYS.runMax=charDef.phys.runMax; PHYS.accel=charDef.phys.accel; PHYS.airAccel=charDef.phys.airAccel;
    }
  }
  if(dash.cooldown>0) dash.cooldown--;
  if(armorFlash>0) armorFlash--;
  // particules de fumée double saut
  for(const sp of djump.smokeParticles){ sp.x+=sp.vx; sp.y+=sp.vy; sp.vy+=0.08; sp.life--; sp.a=sp.life/18; }
  for(let i=djump.smokeParticles.length-1;i>=0;i--) if(djump.smokeParticles[i].life<=0) djump.smokeParticles.splice(i,1);
}

/* Tue un ennemi en créditant le compteur (pour la pièce secrète + dragon aérien) */
function killEnemy(e){
  if(!e.alive) return;
  e.alive=false; enemiesKilled++;
  if(e._type==='caster' && e._givesCoin){
    for(const c of coins){ if(c.cond && c.cond.indexOf('aerien')>=0 && !c._unlocked){ c._unlocked=true; break; } }
  }
}

/* ── [MONSTRES] IA (reprise sandbox monstres, stomp ajouté) ─────── */
function updateMonsters(){
  for(const e of enemies){
    if(!e.alive || !e._type) continue;
    if(++e.tick>10){ e.frame=(e.frame+1)%2; e.tick=0; }

    if(e._type==='walker'){
      if(e.patrol){
        const lookX = e.vx>0 ? e.x+e.w+2 : e.x-2;
        // sol devant ? on cherche un solide dont le dessus est au niveau des pieds
        let groundAhead = false;
        for(const s of solids){
          if(lookX>=s.x && lookX<=s.x+s.w && e.y+e.h>=s.y-2 && e.y+e.h<=s.y+6){ groundAhead=true; break; }
        }
        if(!groundAhead) e.vx*=-1;
      }
      e.x += e.vx;
      // confinement strict à la zone : demi-tour aux bornes
      if(e.x<=e.zMin){ e.x=e.zMin; if(e.vx<0) e.vx*=-1; }
      if(e.x+e.w>=e.zMax){ e.x=e.zMax-e.w; if(e.vx>0) e.vx*=-1; }
    }
    else if(e._type==='flyer'){
      // vol ondulant uniquement (pas de rush vers le joueur)
      e.phase+=e.oscSpeed; e.y=e.baseY+Math.sin(e.phase)*e.ampY; e.x+=e.hspeed;
      // confinement strict à la zone : aller-retour borné
      if(e.x<=e.zMin){ e.x=e.zMin; if(e.hspeed<0) e.hspeed*=-1; }
      if(e.x+e.w>=e.zMax){ e.x=e.zMax-e.w; if(e.hspeed>0) e.hspeed*=-1; }
    }
    else if(e._type==='caster'){
      if(!p.dead) e.facing=(p.x+p.w/2)>(e.x+e.w/2)?1:-1;
      if(++e.fireTimer>=e.fireRate){
        e.fireTimer=0; e.fireCount=(e.fireCount||0)+1;
        const ox=e.facing===1?e.x+e.w:e.x-10, oy=e.y+e.h*0.4;
        const tdx=(p.x+p.w/2)-ox, tdy=(p.y+p.h/2)-oy;
        const tlen=Math.sqrt(tdx*tdx+tdy*tdy)||1;
        const nvx=(tdx/tlen)*e.projSpeed, nvy=(tdy/tlen)*e.projSpeed;
        if(e.fireCount%3===0){
          for(const off of [0,-0.30,0.30]){
            const fvy=nvy+off*Math.abs(nvy||e.projSpeed);
            const fvx=Math.sign(nvx)*Math.sqrt(Math.max(0,e.projSpeed*e.projSpeed-fvy*fvy));
            monsterProjectiles.push({x:ox,y:oy,vx:fvx,vy:fvy,life:300,frame:0,tick:0});
          }
        } else {
          monsterProjectiles.push({x:ox,y:oy,vx:nvx,vy:nvy,life:300,frame:0,tick:0});
        }
      }
      e.frame=Math.floor(Date.now()/400)%2;
    }
  }

  // Projectiles
  for(const pr of monsterProjectiles){ pr.x+=pr.vx; pr.y+=pr.vy; pr.life--;
    if(++pr.tick>6){pr.frame=(pr.frame+1)%4;pr.tick=0;} }
  monsterProjectiles = monsterProjectiles.filter(pr=>pr.life>0 && pr.x>camX-40 && pr.x<camX+W+40);

  if(p.dead) return;

  // Projectile -> joueur (mort)
  for(let i=monsterProjectiles.length-1;i>=0;i--){
    const pr=monsterProjectiles[i];
    if(aabb(p.x,p.y,p.w,p.h,pr.x,pr.y,10,10)){ monsterProjectiles.splice(i,1); killPlayer(); return; }
  }

  // Contact / stomp ennemis
  for(const e of enemies){
    if(!e.alive||!e._type) continue;
    if(!aabb(p.x,p.y,p.w,p.h,e.x,e.y,e.w,e.h)) continue;
    // DASH (Oscar) ou GÉANT invincible (Victor) : tue l'ennemi au contact
    if(dash.active || giant.invincible>0){ killEnemy(e); continue; }
    // STOMP : descente + pieds au-dessus de la mi-hauteur ennemi
    if(p.vy>0 && (p.y+p.h) < e.y + e.h*0.6){
      killEnemy(e); p.vy=PHYS.jumpForce*0.7;   // rebond
    } else {
      // ARMURE (Corentin) : encaisse jusqu'à 2 coups avant de mourir
      if(charDef.hasArmor && armorHP>0){ armorHP--; armorFlash=90; e.alive=false; }
      else { killPlayer(); return; }
    }
  }
}

/* ── [NIVEAU] Boucle ────────────────────────────────────────────── */
function update(){
  if(levelDone) return;
  // chrono du run : tourne tant que le joueur est vivant et la course active
  if(runActive && !p.dead) runFrames++;
  updatePlayer();
  updateMechanics();
  updateMonsters();
  checkLevelInteractions();
  updateCamera();
}

/* ===================================================================
   [BLOC BAPTISTE] — sprite repris verbatim du sandbox_V3.html
   >>> POUR BRANCHER LE SANDBOX PERSO : retirer ce bloc et importer
       drawBaptiste / baptisteHead (et la fonction pr) du sandbox. <<<
=================================================================== */
// pr fourni par module externe

// drawBaptiste fourni par module externe

function baptisteHead(d,H){
  const sk='#f2c898',skD='#d4a272',skDD='#b07848',skL='#fae0b8';
  const ha='#5c3010',haD='#3a1e08',haL='#7a4820',eye='#1a1008';
  [3,4,5,6,7,8,9,10,11,12,13,14,15,16].forEach(x=>d(x,H,x<6||x>13?haD:ha));
  [2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17].forEach(x=>d(x,H+1,x<4||x>15?haD:x<6||x>13?ha:haL));
  [2,3,4,5,6,16,17].forEach(x=>d(x,H+2,x<4||x>15?haD:ha));
  d(8,H,haL);d(9,H,haL);
  for(let x=3;x<17;x++)d(x,H+3,x<5||x>14?skD:skL);
  for(let i=4;i<13;i++){d(2,H+i,skD);d(3,H+i,skD);for(let x=4;x<16;x++)d(x,H+i,i<6?skL:sk);d(16,H+i,skD);d(17,H+i,skD);}
  d(17,H+5,sk);d(18,H+6,skD);d(18,H+7,skDD);d(17,H+8,sk);
  d(2,H+5,sk);d(1,H+6,skD);d(1,H+7,skDD);d(2,H+8,sk);
  d(4,H+4,haD);d(5,H+4,ha);d(6,H+4,ha);d(12,H+4,ha);d(13,H+4,ha);d(14,H+4,haD);
  [4,5,6].forEach(x=>{d(x,H+6,'#fff');d(x,H+8,skD);});d(4,H+7,'#fff');d(5,H+7,eye);d(6,H+7,'#fff');
  [12,13,14].forEach(x=>{d(x,H+6,'#fff');d(x,H+8,skD);});d(12,H+7,'#fff');d(13,H+7,eye);d(14,H+7,'#fff');
  d(9,H+8,skD);d(10,H+9,skD);d(10,H+10,skDD);
  d(7,H+11,skD);d(8,H+11,skDD);d(9,H+11,skDD);d(10,H+11,skDD);d(11,H+11,skDD);d(12,H+11,skD);
  d(8,H+12,skD);d(11,H+12,skD);
  d(4,H+12,skD);for(let x=5;x<14;x++)d(x,H+12,x===9||x===10?skL:sk);d(14,H+12,skD);d(15,H+12,skD);
  d(5,H+13,skD);d(6,H+13,skD);for(let x=7;x<13;x++)d(x,H+13,skD);d(13,H+13,skD);d(14,H+13,skD);
}


/* ===================================================================
   [COUCHE MONSTRES] — sprites repris verbatim du sandbox_monsters_V1
   >>> POUR RELIER LE SANDBOX MONSTRES : ces fonctions de dessin sont
       identiques au sandbox ; remplacer par import si mutualise. <<<
=================================================================== */
// drawWalkerSprite fourni par module externe

// drawFlyerSprite fourni par module externe

// drawCasterSprite fourni par module externe

/* ── Sprite Dasher (Loup) ─────────────────────────────────────────── */
function drawDasherSprite(x,y,frame,dir,w,h,state) {
  ctx.save();
  ctx.translate(x+w/2, y+h);
  ctx.scale((w/28)*dir, h/22);

  /* Telegraphing : flash blanc */
  if (state === 'telegraphing') {
    ctx.globalAlpha = 0.5 + 0.5*Math.sin(Date.now()*0.04);
    ctx.fillStyle='#ffffff';
    ctx.fillRect(-14,-22,28,22);
    ctx.restore();
    return;
  }

  const legShift = (state==='dashing') ? 0 : (frame===0?1:-1);

  /* Queue */
  ctx.fillStyle='#888898'; ctx.fillRect(-14,-10,6,4); ctx.fillRect(-18,-12,5,3); ctx.fillRect(-20,-14,3,3);
  ctx.fillStyle='#ccccdd'; ctx.fillRect(-13,-9,4,2); ctx.fillRect(-17,-11,4,2);

  /* Corps */
  ctx.fillStyle='#7a7a8a'; ctx.fillRect(-10,-18,20,14);
  ctx.fillStyle='#9a9aaa'; ctx.fillRect(-8,-20,16,4);
  ctx.fillStyle='#6a6a7a'; ctx.fillRect(-10,-18,1,14); ctx.fillRect(9,-18,1,14);

  /* Ventre clair */
  ctx.fillStyle='#ccccdd'; ctx.fillRect(-5,-14,10,8);

  /* Tête */
  ctx.fillStyle='#7a7a8a'; ctx.fillRect(6,-22,10,10);
  ctx.fillStyle='#9a9aaa'; ctx.fillRect(8,-22,6,3);
  /* Museau */
  ctx.fillStyle='#888898'; ctx.fillRect(12,-18,6,5); ctx.fillRect(14,-14,4,3);
  /* Dents */
  ctx.fillStyle='#f0f0f0'; ctx.fillRect(14,-14,2,4); ctx.fillRect(16,-14,2,3);
  /* Oeil */
  ctx.fillStyle='#ff3300'; ctx.fillRect(9,-20,3,3);
  ctx.fillStyle='#220000'; ctx.fillRect(10,-20,2,2);
  /* Oreilles */
  ctx.fillStyle='#6a6a7a'; ctx.fillRect(6,-26,4,5); ctx.fillRect(11,-26,4,5);
  ctx.fillStyle='#cc8888'; ctx.fillRect(7,-25,2,3); ctx.fillRect(12,-25,2,3);

  /* Pattes — animation marche ou charge */
  ctx.fillStyle='#6a6a7a';
  ctx.fillRect(-9,-4+legShift,5,6-legShift); ctx.fillRect(-4,-4-legShift,4,6+legShift);
  ctx.fillRect(1,-4+legShift,4,6-legShift);  ctx.fillRect(5,-4-legShift,4,6+legShift);
  /* Griffes */
  ctx.fillStyle='#cccccc';
  ctx.fillRect(-10,2+legShift,3,2); ctx.fillRect(-5,2-legShift,3,2);
  ctx.fillRect(0,2+legShift,3,2);   ctx.fillRect(5,2-legShift,3,2);

  ctx.restore();
}

/* ── Sprite Bomber (Slime rebondissant) ──────────────────────────── */
function drawBomberSprite(x,y,frame,w,h) {
  ctx.save();
  ctx.translate(x+w/2, y+h);
  ctx.scale(w/20, h/20);

  /* Corps — blob elliptique vert */
  const slimeColor  = '#88cc00';
  const slimeDark   = '#558800';
  const slimeLight  = '#aae820';

  ctx.fillStyle=slimeDark;
  ctx.fillRect(-9,-12,18,10);
  ctx.fillStyle=slimeColor;
  ctx.fillRect(-10,-16,20,14);
  ctx.fillStyle=slimeLight;
  ctx.fillRect(-7,-18,14,4);
  ctx.fillRect(-5,-19,10,2);
  /* Flancs */
  ctx.fillStyle=slimeColor;
  ctx.fillRect(-10,-14,2,10); ctx.fillRect(8,-14,2,10);
  /* Base */
  ctx.fillStyle=slimeDark;
  ctx.fillRect(-8,-2,16,4); ctx.fillRect(-6,2,12,2);
  /* Reflet */
  ctx.fillStyle=slimeLight;
  ctx.fillRect(-6,-17,5,3); ctx.fillRect(-4,-15,3,2);
  /* Yeux */
  ctx.fillStyle='#1a2200'; ctx.fillRect(-5,-13,4,4); ctx.fillRect(1,-13,4,4);
  ctx.fillStyle='#ffffff'; ctx.fillRect(-4,-12,2,2); ctx.fillRect(2,-12,2,2);
  /* Sourire — animation frame */
  ctx.fillStyle='#1a2200';
  if(frame===0){ ctx.fillRect(-3,-8,6,2); ctx.fillRect(-4,-7,2,2); ctx.fillRect(2,-7,2,2); }
  else          { ctx.fillRect(-3,-9,6,2); }

  ctx.restore();
}


/* ── [NIVEAU] Rendu fond ────────────────────────────────────────── */
function drawBg(){
  // ciel dégradé
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#6db4e8'); g.addColorStop(1,'#bfe3f5');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // décor parallax
  for(const d of decoItems){
    const par = d.plan==='fond'?0.35 : d.plan==='secret'?1 : 0.6;
    const sx = d.x - camX*par;
    if(sx+d.w < -40 || sx > W+40) continue;
    if(d.type==='deco_nuage'){
      ctx.fillStyle='rgba(255,255,255,0.85)';
      ctx.fillRect(sx,d.y,d.w,d.h); ctx.fillRect(sx+6,d.y-6,d.w-12,6); ctx.fillRect(sx-6,d.y+4,d.w+12,d.h-8);
    } else if(d.type==='deco_colline'){
      // colline LARGE, BASSE de profil mais bien ancrée : base jusqu'en bas du
      // monde (jamais flottante au-dessus d'un trou), sommet arrondi en hauteur.
      const cx = sx + d.w/2;
      const baseY = H;                          // bas de l'écran
      const apexY = GROUND_SURFACE - 88;        // sommet nettement au-dessus du sol
      const shoulder = apexY + 40;
      ctx.fillStyle='#62b552';
      ctx.beginPath();
      ctx.moveTo(sx, baseY);
      ctx.lineTo(sx + d.w*0.20, shoulder);
      ctx.quadraticCurveTo(cx, apexY, sx + d.w*0.80, shoulder);
      ctx.lineTo(sx + d.w, baseY);
      ctx.closePath(); ctx.fill();
      // crête plus claire
      ctx.fillStyle='#73c662';
      ctx.beginPath();
      ctx.moveTo(sx + d.w*0.20, shoulder);
      ctx.quadraticCurveTo(cx, apexY, sx + d.w*0.80, shoulder);
      ctx.quadraticCurveTo(cx, apexY + 22, sx + d.w*0.20, shoulder);
      ctx.closePath(); ctx.fill();
    } else if(d.type==='deco_buisson'){
      ctx.fillStyle='#3f9a36'; ctx.fillRect(sx,d.y,d.w,d.h); ctx.fillRect(sx+3,d.y-4,d.w-6,4);
    } else if(d.type==='alcove'){
      // assombrissement de la zone secrète
      ctx.fillStyle='rgba(20,18,40,0.55)';
      ctx.fillRect(d.x-camX,d.y,d.w,d.h);
    }
  }
}

/* Pièce-canard : petit canard pixel inspiré du logo (corps doré, bec orange).
   Dessiné dans le cadre (x,y,w,h) ; les proportions suivent une grille 16×16. */
function drawDuckCoin(x,y,w,h){
  const u=w/16, v=h/16, px=(a,b,c,d,col)=>{ ctx.fillStyle=col; ctx.fillRect(x+a*u,y+b*v,c*u,d*v); };
  const BODY='#ffcc22', BODY_D='#f0b81e', OUT='#fff7e6', BEAK='#ff9a1f', EYE='#3a2a10';
  // contour crème (halo derrière le corps)
  px(3,7,11,8,OUT);
  px(8,2,5,6,OUT);
  // corps + tête (doré)
  px(4,8,9,6,BODY);          // corps
  px(9,3,4,5,BODY);          // tête
  px(3,11,2,2,BODY);         // queue relevée
  // ventre / dessous plus foncé
  px(5,12,7,2,BODY_D);
  px(9,7,4,1,BODY_D);
  // bec orange
  px(13,5,3,2,BEAK);
  // œil
  px(11,4,1,2,EYE);
  // aile suggérée
  px(6,9,4,3,BODY_D);
}

function drawWorld(){
  ctx.save();
  ctx.translate(-Math.round(camX),0);
  const x0=camX-32, x1=camX+W+32;

  // sol & solides
  for(const s of solids){
    if(s.x+s.w<x0||s.x>x1) continue;
    if(s.noDraw) continue;
    if(s.secretWall){
      // mur SECRET : pierre uniforme couvrant TOUT jusqu'au sol, aucun indice
      // du passage accroupi (la "jupe" basse masque l'ouverture, purement visuel).
      ctx.fillStyle='#6f6f79'; ctx.fillRect(s.x,s.y,s.w, GROUND_SURFACE - s.y);
      ctx.fillStyle='#7e7e88';
      for(let ry=s.y; ry<GROUND_SURFACE; ry+=8){
        const off=(((ry-s.y)/8)|0)%2?8:0;
        for(let rx=s.x-off; rx<s.x+s.w; rx+=16)
          ctx.fillRect(Math.max(s.x,rx)+1,ry+1,Math.min(14,s.x+s.w-Math.max(s.x,rx))-2,6);
      }
      ctx.fillStyle='#8c8c96'; ctx.fillRect(s.x,s.y,s.w,2);
      ctx.strokeStyle='rgba(40,40,50,.5)'; ctx.strokeRect(s.x+.5,s.y+.5,s.w-1,(GROUND_SURFACE-s.y)-1);
    } else if(s.stone){
      // bloc de pierre (décor d'alcôve, top solide marchable)
      ctx.fillStyle='#7c7c86'; ctx.fillRect(s.x,s.y,s.w,s.h);
      ctx.fillStyle='#9a9aa4';
      for(let ry=s.y; ry<s.y+s.h; ry+=8){
        const off=(((ry-s.y)/8)|0)%2?8:0;
        for(let rx=s.x-off; rx<s.x+s.w; rx+=16)
          ctx.fillRect(Math.max(s.x,rx)+1,ry+1,Math.min(14,s.x+s.w-Math.max(s.x,rx))-2,6);
      }
      ctx.fillStyle='#b6b6c0'; ctx.fillRect(s.x,s.y,s.w,2);
      ctx.fillStyle='#4c4c56'; ctx.fillRect(s.x,s.y+s.h-2,s.w,2);
      ctx.strokeStyle='rgba(40,40,50,.6)'; ctx.strokeRect(s.x+.5,s.y+.5,s.w-1,s.h-1);
    } else if(s.pipe){
      ctx.fillStyle='#8a8a96'; ctx.fillRect(s.x,s.y,s.w,s.h);
      ctx.fillStyle='#6e6e7a'; ctx.fillRect(s.x,s.y,s.w,s.h);
      // appareillage en briques
      ctx.fillStyle='#9a9aa6';
      for(let ry=s.y; ry<s.y+s.h; ry+=8){
        const off = (((ry-s.y)/8)|0)%2 ? 8 : 0;
        for(let rx=s.x-off; rx<s.x+s.w; rx+=16){
          ctx.fillRect(Math.max(s.x,rx)+1, ry+1, Math.min(14,s.x+s.w-Math.max(s.x,rx))-2, 6);
        }
      }
      ctx.fillStyle='#bfbfca'; ctx.fillRect(s.x,s.y,s.w,2);          // arête claire
      ctx.fillStyle='#54545e'; ctx.fillRect(s.x,s.y+s.h-2,s.w,2);    // base sombre
      ctx.strokeStyle='rgba(40,40,50,.6)'; ctx.strokeRect(s.x+.5,s.y+.5,s.w-1,s.h-1);
    } else if(Math.abs((s.y) - GROUND_Y + s.h) < 2 || s.y >= GROUND_Y - TILE){
      // sol terreux
      ctx.fillStyle='#7a4a22'; ctx.fillRect(s.x,s.y,s.w,s.h);
      ctx.fillStyle='#5e3618'; ctx.fillRect(s.x,s.y+TILE,s.w,s.h-TILE);
      ctx.fillStyle='#4caa30'; ctx.fillRect(s.x,s.y,s.w,5);
      ctx.fillStyle='#3f9128';
      for(let gx=s.x;gx<s.x+s.w;gx+=8) ctx.fillRect(gx,s.y+4,4,2);
    } else {
      // bloc de pierre ocre
      ctx.fillStyle='#c89048'; ctx.fillRect(s.x,s.y,s.w,s.h);
      ctx.fillStyle='#e0ad60'; ctx.fillRect(s.x,s.y,s.w,3);
      ctx.fillStyle='#9a6c30'; ctx.fillRect(s.x,s.y+s.h-3,s.w,3);
      ctx.strokeStyle='rgba(90,60,20,.5)'; ctx.strokeRect(s.x+.5,s.y+.5,s.w-1,s.h-1);
    }
  }
  // plateformes suspendues
  for(const pf of platforms){
    if(pf.x+pf.w<x0||pf.x>x1) continue;
    if(pf.texture==='dragon'){
      // plateforme de texture différente sous le dragon aérien (pierre violacée)
      ctx.fillStyle='#3a2a52'; ctx.fillRect(pf.x,pf.y+3,pf.w,pf.h-3);
      ctx.fillStyle='#7a5aa0'; ctx.fillRect(pf.x,pf.y,pf.w,5);
      ctx.fillStyle='#9a7ac0';
      for(let rx=pf.x+2;rx<pf.x+pf.w-2;rx+=6) ctx.fillRect(rx,pf.y+1,3,2);
    } else {
      ctx.fillStyle='#5a3010'; ctx.fillRect(pf.x,pf.y+3,pf.h>0?pf.w:0,pf.h-3);
      ctx.fillStyle='#6aa838'; ctx.fillRect(pf.x,pf.y,pf.w,5);
    }
  }
  // blocs cassables
  for(const b of breakables){
    if(!b.alive||b.x+b.w<x0||b.x>x1) continue;
    if(b.isTrampoCover){
      // bloc-signal : caisse ressort (indique qu'il cache un trampoline)
      ctx.fillStyle='#caa030'; ctx.fillRect(b.x,b.y,b.w,b.h);
      ctx.fillStyle='#e6c450'; ctx.fillRect(b.x,b.y,b.w,3);
      ctx.fillStyle='#8a6a18'; ctx.fillRect(b.x,b.y+b.h-3,b.w,3);
      ctx.strokeStyle='rgba(80,60,10,.7)'; ctx.strokeRect(b.x+.5,b.y+.5,b.w-1,b.h-1);
      // petite flèche ressort vers le haut
      ctx.fillStyle='#cc3322';
      ctx.fillRect(b.x+b.w/2-1,b.y+4,2,b.h-7);
      ctx.fillRect(b.x+b.w/2-3,b.y+5,6,2);
      continue;
    }
    ctx.fillStyle='#b5651d'; ctx.fillRect(b.x,b.y,b.w,b.h);
    ctx.fillStyle='#d98a3a'; ctx.fillRect(b.x,b.y,b.w,3);
    ctx.strokeStyle='rgba(60,30,10,.6)'; ctx.strokeRect(b.x+.5,b.y+.5,b.w-1,b.h-1);
    // fissure
    ctx.strokeStyle='rgba(60,30,10,.5)'; ctx.beginPath();
    ctx.moveTo(b.x+b.w*0.5,b.y+2); ctx.lineTo(b.x+b.w*0.35,b.y+b.h*0.5); ctx.lineTo(b.x+b.w*0.6,b.y+b.h-2); ctx.stroke();
  }
  // movers
  for(const m of movers){
    if(m.x+m.w<x0||m.x>x1) continue;
    ctx.fillStyle='#444c66'; ctx.fillRect(m.x,m.y,m.w,m.h);
    ctx.fillStyle='#6a74a0'; ctx.fillRect(m.x,m.y,m.w,4);
    ctx.fillStyle='#2c3148'; ctx.fillRect(m.x,m.y+m.h-3,m.w,3);
  }
  // blocs tombants
  for(const f of fallers){
    if(f.state==='gone'||f.x+f.w<x0||f.x>x1) continue;
    let ox=0; if(f.state==='shaking') ox=(Math.random()-.5)*2;
    ctx.fillStyle='#a86038'; ctx.fillRect(f.x+ox,f.y,f.w,f.h);
    ctx.fillStyle='#c8824a'; ctx.fillRect(f.x+ox,f.y,f.w,3);
    ctx.strokeStyle='rgba(60,30,10,.6)'; ctx.strokeRect(f.x+ox+.5,f.y+.5,f.w-1,f.h-1);
  }
  // pics
  for(const s of spikes){
    if(s.x+s.w<x0||s.x>x1) continue;
    const n=Math.floor(s.w/8);
    for(let i=0;i<n;i++){
      const px=s.x+i*8;
      ctx.fillStyle='#4a4e58'; ctx.beginPath();
      ctx.moveTo(px,s.y+s.h); ctx.lineTo(px+4,s.y); ctx.lineTo(px+8,s.y+s.h); ctx.fill();
      ctx.fillStyle='#7a808c'; ctx.beginPath();
      ctx.moveTo(px+1,s.y+s.h); ctx.lineTo(px+4,s.y+3); ctx.lineTo(px+4,s.y+s.h); ctx.fill();
    }
    ctx.fillStyle='#33363e'; ctx.fillRect(s.x,s.y+s.h-2,s.w,2);
  }
  // trampolines
  for(const t of trampolines){
    if(t.x+t.w<x0||t.x>x1) continue;
    if(t.hidden){
      // ressort caché : petit indice visible au-dessus du bloc (point 3)
      if(t.peek){
        ctx.fillStyle='#ff5533'; ctx.fillRect(t.x+t.w/2-3, t.y-3, 6, 4);
        ctx.fillStyle='#ffaa33'; ctx.fillRect(t.x+t.w/2-3, t.y-5, 6, 2);
      }
      continue;
    }
    const sq = t.bounce>0?4:0;
    ctx.fillStyle='#cc3322'; ctx.fillRect(t.x,t.y+t.h-6+sq,t.w,6-sq);
    ctx.fillStyle='#ff5533'; ctx.fillRect(t.x,t.y+4+sq,t.w,4);
    ctx.fillStyle='#ffaa33'; ctx.fillRect(t.x+2,t.y+sq,t.w-4,4);
    ctx.fillStyle='#883322';
    for(let yy=t.y+8+sq;yy<t.y+t.h-4;yy+=3) ctx.fillRect(t.x+2,yy,t.w-4,1);
  }
  // pièces-récompense (id dragon : visible si débloquée ; pièce secrète zone 10 : invisible)
  for(const c of coins){
    if(c.taken||c.x+c.w<x0||c.x>x1) continue;
    if(c.hiddenCoin) continue;   // cachée derrière la texture du mur, jamais dessinée
    if(c.cond && c.cond.indexOf('aerien')>=0 && !c._unlocked) continue;
    drawDuckCoin(c.x, c.y + Math.sin(Date.now()/260)*1.5, c.w, c.h);
  }
  // monstres + projectiles (couche monstres)
  drawMonsterLayer();
  // mât + château
  if(flag){
    ctx.fillStyle='#cfcfcf'; ctx.fillRect(flag.x+flag.w/2-1,flag.y,2,flag.h);
    ctx.fillStyle='#22aa44'; ctx.fillRect(flag.x+flag.w/2+1,flag.y+4,12,8);
    ctx.fillStyle='#ffdd44'; ctx.fillRect(flag.x+flag.w/2-3,flag.y-3,6,4);
  }
  if(castle){
    ctx.fillStyle='#b86a3a'; ctx.fillRect(castle.x,castle.y,castle.w,castle.h);
    ctx.fillStyle='#9a5530'; ctx.fillRect(castle.x,castle.y,castle.w,6);
    ctx.fillStyle='#3a2410'; ctx.fillRect(castle.x+castle.w/2-8,castle.y+castle.h-22,16,22);
    for(let i=0;i<castle.w;i+=16){ ctx.fillStyle='#b86a3a'; ctx.fillRect(castle.x+i,castle.y-8,10,8); }
  }
  // joueur
  drawPlayer();
  ctx.restore();
}

/* ── [NIVEAU] Rendu joueur (convention sandbox : translate au bas-centre) ── */
function drawPlayer(){
  if(p.dead) return;
  // traînée de dash (Oscar) — décroît en continu, même après la fin du dash,
  // pour disparaître rapidement au lieu de rester figée à l'écran.
  for(let ti=0;ti<dash.trail.length;ti++){
    const t=dash.trail[ti]; ctx.save(); ctx.globalAlpha=t.a*0.7;
    ctx.fillStyle = ti/Math.max(dash.trail.length-1,1)<0.3 ? '#ffffff' : charDef.color;
    ctx.fillRect(Math.round(t.x),Math.round(t.y),t.w||p.w,t.h); ctx.restore();
  }
  for(const t of dash.trail) t.a*=0.72;
  while(dash.trail.length && dash.trail[0].a<0.04) dash.trail.shift();
  // fumée de double saut (Timothée)
  for(const sp of djump.smokeParticles){ ctx.save(); ctx.globalAlpha=Math.max(0,sp.a); ctx.fillStyle='#aaddff'; ctx.fillRect(Math.round(sp.x),Math.round(sp.y),3,3); ctx.restore(); }
  // boules de feu (Matteo)
  for(const b of balls){ ctx.fillStyle='#3a1804'; ctx.fillRect(Math.round(b.x-b.r),Math.round(b.y-b.r),b.r*2,b.r*2);
    ctx.fillStyle='#6b3410'; ctx.fillRect(Math.round(b.x-b.r+1),Math.round(b.y-b.r+1),b.r*2-2,b.r*2-2); }
  // aura géant (Victor)
  if(giant.active){ ctx.save(); ctx.globalAlpha=0.13+Math.sin(giant.flashTick*0.3)*0.06; ctx.fillStyle='#ff4444'; ctx.fillRect(Math.round(p.x-6),Math.round(p.y-4),p.w+12,p.h+4); ctx.restore(); }

  const px=Math.round(p.x), py=Math.round(p.y);
  const cr=p.crouching, air=!p.onGround;
  const lf=cr||air?0:p.walkFrame;
  const P=4;
  const la=[[[0,0],[4,0]],[[0,-P],[4,P]],[[0,0],[4,0]],[[0,P],[4,-P]]][lf];
  ctx.save();
  ctx.translate(px+p.w/2, py+p.h);
  if(p.facing===-1) ctx.scale(-1,1);
  // géant : agrandit le sprite d'un facteur 1.5
  if(giant.active){ const s=p.h/charDef.drawH; ctx.scale(s,s); }
  drawCharacterSprite(SELECTED_CID, cr, air, la);
  ctx.restore();

  // flash d'armure (Corentin) sur le corps
  if(charDef.hasArmor && armorHP>0 && armorFlash>0 && Math.floor(armorFlash/5)%2===1){
    ctx.save(); ctx.globalAlpha=0.35; ctx.fillStyle='#ff8800'; ctx.fillRect(px,py,p.w,p.h); ctx.restore();
  }
}

function drawMonsterLayer(){
  for(const fpr of monsterProjectiles){
    const fx=Math.round(fpr.x), fy=Math.round(fpr.y);
    const gl=[0,2,1,3][fpr.frame];
    ctx.fillStyle='#ffffff'; ctx.fillRect(fx+2,fy+2,6,6);
    ctx.fillStyle='#ffee00'; ctx.fillRect(fx+1,fy+1,8,8);
    ctx.fillStyle='#ff8800'; ctx.fillRect(fx,fy,10,10);
    ctx.fillStyle='#ff4400'; ctx.fillRect(fx-2+gl,fy+2,4,6); ctx.fillRect(fx+8-gl,fy+2,4,6); ctx.fillRect(fx+2,fy-2+gl,6,4);
    ctx.fillStyle='#fff8cc'; ctx.fillRect(fx+3,fy+3,4,4);
  }
  for(const e of enemies){
    if(!e.alive||!e._type) continue;
    const ex=Math.round(e.x), ey=Math.round(e.y);
    if(ex+e.w<camX-40||ex>camX+W+40) continue;
    if(e._type==='walker') drawWalkerSprite(ex,ey,e.frame,e.vx<0?-1:1,e.w,e.h);
    if(e._type==='flyer')  drawFlyerSprite(ex,ey,e.frame,e.hspeed<0?-1:1,e.w,e.h);
    if(e._type==='caster') drawCasterSprite(ex,ey,e.frame,e.facing,e.w,e.h);
  }
}

/* ── [NIVEAU] HUD ───────────────────────────────────────────────── */
function drawHUD(){
  ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(6,6,108,22);
  drawDuckCoin(11, 8, 16, 16);   // icône canard (même visuel que les pièces du niveau)
  ctx.fillStyle='#fff'; ctx.font='bold 12px monospace';
  ctx.fillText('\u00d7 '+coinCount+' / 3', 28, 21);
  // indicateur de pouvoir selon le perso
  let pwr='';
  if(charDef.hasDash)            pwr = dash.cooldown>0 ? 'Dash …' : 'Dash [F]';
  else if(charDef.hasDoubleJump) pwr = djump.used && !p.onGround ? 'Saut \u00d71' : 'Double saut';
  else if(charDef.hasFireball)   pwr = ballCd>0 ? 'Tir …' : 'Tir [F]';
  else if(charDef.hasGiant)      pwr = giant.active ? 'G\u00c9ANT '+Math.ceil(giant.timer/60)+'s' : (giant.charges>0?'G\u00e9ant [F] \u00d7'+giant.charges:'\u00c9puis\u00e9');
  else if(charDef.hasArmor)      pwr = 'Armure '+armorHP+'/'+charDef.armorMax;
  if(pwr){
    ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(6,32,108,20);
    ctx.fillStyle=charDef.color; ctx.fillRect(10,38,8,8);
    ctx.fillStyle='#fff'; ctx.font='bold 11px monospace'; ctx.fillText(pwr,22,46);
  }
  // chrono du run (haut-droite)
  const tStr = formatTime(Math.round(runFrames/FPS*1000));
  ctx.font='bold 16px monospace';
  const tw = ctx.measureText(tStr).width;
  const tx = W - tw - 14;
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(tx-8, 6, tw+16, 24);
  ctx.fillStyle='#ffe680'; ctx.fillText(tStr, tx, 23);
}

/* ── [NOYAU] Boucle principale ──────────────────────────────────── */
function loop(){
  update();
  ctx.save();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.scale(S,S);
  drawBg();
  drawWorld();
  drawHUD();
  ctx.restore();
  requestAnimationFrame(loop);
}

/* ── Démarrage (appelé par index.html après sélection du perso) ── */
let _started = false;
function startGame(){
  if(_started) return; _started=true;
  resize();
  buildLevel();
  placePlayer();
  runFrames = 0; runActive = true;
  loop();
}
window.startGame = startGame;


/* Exposition pour index.html */
window.restartLevel = restartLevel;
