
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

/* ── [NOYAU] Entrées (clavier + tactile mobile) ─────────────────────
   La logique est centralisée dans des fonctions appelées aussi bien par le
   clavier que par les contrôles tactiles, pour un comportement identique. */
const keys = {};
let jumpJP = false;

// Appui sur SAUT (Space / ↑ / W / bouton tactile)
function doJumpPress(){
  if(p.dead) return;
  if(!keys['Space']) jumpJP = true;
  if(p.onGround && window.Audio2) Audio2.sfx('jump');   // saut depuis le sol
  // Double saut (Timothée)
  if(charDef.hasDoubleJump && !p.onGround && !djump.used){
    djump.used=true; p.vy=PHYS.jumpForce;
    if(window.Audio2) Audio2.sfx('jump');
    for(let i=0;i<8;i++) djump.smokeParticles.push({x:p.x+p.w/2,y:p.y+p.h,vx:(Math.random()-.5)*2,vy:-Math.random()*1.5,life:18,a:1});
  }
  keys['Space']=true;   // état "saut tenu" (sert au saut variable)
}
// Relâché de SAUT : coupe l'élan vers le haut (saut variable)
function doJumpRelease(){
  keys['Space']=false;
  if(p.vy < PHYS.jumpCutoff) p.vy = PHYS.jumpCutoff;
}
// Appui sur POUVOIR (F / bouton tactile) : pouvoir du perso, ou lancer un caleçon (Louise)
function doPowerPress(){
  if(p.dead) return;
  if(boss){ caleconAction(); }
  else if(charDef.hasDash && !dash.active && dash.cooldown===0){ triggerDash(); if(window.Audio2) Audio2.sfx('throw'); }
  else if(charDef.hasFireball && ballCd===0){ shootBall(); if(window.Audio2) Audio2.sfx('throw'); }
  else if(charDef.hasGiant && !giant.active && giant.charges>0){ activateGiant(); if(window.Audio2) Audio2.sfx('unlock'); }
}
// Direction tactile : -1 gauche, 1 droite, 0 neutre
function setTouchDir(dir){
  keys['ArrowLeft']  = (dir<0);
  keys['ArrowRight'] = (dir>0);
}
// expose pour la couche tactile (index.html)
window.CCB_input = { jumpPress:doJumpPress, jumpRelease:doJumpRelease, power:doPowerPress, dir:setTouchDir,
                     restart:()=>{ if(typeof restartLevel==='function') restartLevel(); } };

window.addEventListener('keydown', e => {
  if(e.repeat){ if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); return; }
  if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){ doJumpPress(); }
  if(e.code==='KeyF'){ doPowerPress(); }
  keys[e.code] = true;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if(e.code==='KeyR') restartLevel();
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
  if((e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW')){ doJumpRelease(); }
});

/* ── [NIVEAU] Donnees brutes embarquees ─────────────────────────── */
// LEVEL fourni par level1.js (window.LEVEL)
const LEVEL = window.LEVEL;

/* ====================================================================
   [THÈMES] Habillage visuel par niveau. Chaque niveau choisit son thème
   via LEVEL.theme ('plaine' | 'grotte' | 'chateau'). Le rendu (drawBg,
   drawWorld) lit l'objet THEME au lieu de couleurs codées en dur.
   Le thème 'plaine' reproduit EXACTEMENT les couleurs d'origine du N1.
==================================================================== */
const THEMES = {
  plaine: {
    sky:['#6db4e8','#bfe3f5'],          // dégradé ciel
    ground:{ soil:'#7a4a22', soilDeep:'#5e3618', top:'#4caa30', topDot:'#3f9128', topH:5 },
    block:{ face:'#c89048', top:'#e0ad60', bottom:'#9a6c30', edge:'rgba(90,60,20,.5)' },
    platform:{ base:'#5a3010', top:'#6aa838' },
    stone:{ face:'#7c7c86', brick:'#9a9aa4', top:'#b6b6c0', bottom:'#4c4c56', edge:'rgba(40,40,50,.6)' },
    ambient:null                         // pas d'overlay d'ambiance
  },
  grotte: {
    sky:['#241d33','#3a2d4a'],          // sous-sol bleu-nuit profond
    ground:{ soil:'#4a3a52', soilDeep:'#2e2436', top:'#6a5a72', topDot:'#56465e', topH:4 },
    block:{ face:'#5a5266', top:'#6e6678', bottom:'#3a3442', edge:'rgba(20,16,30,.6)' },
    platform:{ base:'#3a2c44', top:'#6a5a7c' },
    stone:{ face:'#4e4658', brick:'#5e5668', top:'#6e6678', bottom:'#322c3c', edge:'rgba(15,10,22,.7)' },
    ambient:'rgba(20,14,38,0.28)',       // léger assombrissement de caverne
    ceiling:{ depth:40, rock:'#3a3142', rockDeep:'#2a2336', edge:'#544a60' }  // voûte rocheuse solide en haut
  },
  chateau: {
    sky:['#2a1216','#14080a'],          // ciel volcanique sombre, rougeoyant en bas
    ground:{ soil:'#3a2228', soilDeep:'#241317', top:'#5a2d24', topDot:'#7a3a2c', topH:4 },
    block:{ face:'#3e2e34', top:'#52403e', bottom:'#241a1e', edge:'rgba(10,4,6,.7)' },
    platform:{ base:'#2e1e20', top:'#6a3a2c' },
    stone:{ face:'#463436', brick:'#56403e', top:'#5e4644', bottom:'#281c1e', edge:'rgba(8,2,4,.7)' },
    ambient:'rgba(40,8,4,0.22)',         // rougeoiement ambiant
    glow:true                            // active braises/lueurs de lave
  }
};
let THEME = THEMES[(LEVEL && LEVEL.theme) || 'plaine'] || THEMES.plaine;
let themeTick = 0;   // horloge pour les animations (lave, torches, braises)
let mechTick = 0;    // horloge des mecaniques (avance dans update, testable hors rendu)
let embers = [];     // particules de braises (thème château)
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

// Profondeur de la voûte (px) — CONSTANTE. Les plafonds bas ont été retirés du
// design : un seul plafond haut, les stalactites y sont accrochées. Source unique
// partagée par le rendu (drawBg) et la collision (collideSolidsY).
function ceilingDepthAtWorld(worldX){
  if(!THEME.ceiling) return 0;
  return THEME.ceiling.depth;
}

/* Collections de monde (remplies par buildLevel) */
let solids = [];        // {x,y,w,h}  collision pleine (sol, blocs solides, tuyaux)
let platforms = [];     // {x,y,w,h}  collision par le dessus uniquement
let spikes = [];        // {x,y,w,h}  mortel au contact
let lava = [];          // {x,y,w,h}  surface mortelle (chateau) — tue TOUT le monde
let retractSpikes = []; // {x,y,w,h,period,phase,duty,out}  pics retractables sequences
let iceSpikes = [];     // {x,y,w,h,dir}  pics de glace fixes mortels (stalagmites/stalactites)
let geysers = [];       // {x,baseY,w,maxH,period,phase,curH}  colonnes de lave intermittentes
let sinkers = [];       // {x,y,w,h,baseY,maxDrop,state,t}  plateformes qui sombrent
let pistons = [];       // {x,w,topY,botY,period,phase,y,prevY}  blocs ecraseurs (pilons)
let fragileBlocks = []; // {x,y,w,h,alive}  blocs detruits par souffle dragon / boule Matteo
let seals = [];         // {x,y,w,h,active}  sceaux a activer (3) pour ouvrir la crypte
let cryptDoor = null;   // {x,y,w,h,open}  porte solide tant que les 3 sceaux pas tous actifs
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

/* ── [BOSS] Louise ── */
let boss = null;
let calecons = [];
let bossProjectiles = [];
let bossWall = null;
let carriedCalecons = 0;
let caleconShots = [];
let bossDefeated = false;

/* ── [NIVEAU] Construction depuis le JSON ───────────────────────── */
function buildLevel(){
  solids=[]; platforms=[]; spikes=[]; breakables=[]; movers=[];
  lava=[]; retractSpikes=[]; iceSpikes=[]; geysers=[]; sinkers=[]; pistons=[]; fragileBlocks=[];
  seals=[]; cryptDoor=null;
  fallers=[]; trampolines=[]; coins=[]; enemies=[]; monsterProjectiles=[];
  decoItems=[]; flag=null; castle=null; dragonsKilled={}; coinCount=0; levelDone=false;
  secretCoin=null; secretCoinTaken=false; enemiesKilled=0;
  boss=null; calecons=[]; bossProjectiles=[]; bossWall=null;
  carriedCalecons=0; caleconShots=[]; bossDefeated=false;

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
          solids.push({...r, ice: !!el.ice, stone: !!el.stone, slab: !!el.slab}); break;
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
        case 'pic_glace':
          // pic de glace fixe et MORTEL. dir:'up' (stalagmite sol) ou 'down' (stalactite plafond).
          iceSpikes.push({...r, dir: el.dir||'up'}); break;
        case 'lave':
          // surface mortelle : aucune collision solide, mort au contact (tous persos)
          lava.push({...r}); break;
        case 'pics_retractables': {
          // pics qui sortent/rentrent en cycle. period = duree totale (frames),
          // duty = fraction du cycle ou ils sont SORTIS (0..1), phase = decalage
          // initial en frames (pour sequencer plusieurs groupes en vague).
          const period = el.period!=null ? el.period : 150;
          const duty   = el.duty!=null   ? el.duty   : 0.5;
          const phase  = el.phase!=null  ? el.phase  : 0;
          retractSpikes.push({...r, period, duty, phase, out:true});
          break;
        }
        case 'geyser_lave': {
          // colonne de lave qui jaillit du sol par cycles. r.y = sommet quand
          // la colonne est a sa hauteur de DONNEE (h tuiles) ; on s'en sert
          // comme base. maxH = hauteur de jaillissement (tuiles), defaut = h.
          const period = el.period!=null ? el.period : 180;
          const phase  = el.phase!=null  ? el.phase  : 0;
          const duty   = el.duty!=null   ? el.duty   : 0.4;   // fraction haute
          const maxH   = (el.hauteur_max!=null ? el.hauteur_max : el.h) * TILE;
          // base = surface du sol au pied de la colonne
          const baseY = GROUND_SURFACE;
          geysers.push({ x:r.x, w:r.w, baseY, maxH, period, phase, duty, curH:0 });
          break;
        }
        case 'plateforme_sombrante': {
          // plateforme stable jusqu'a appui ; sombre lentement sous le poids,
          // remonte si liberee a temps. maxDrop = enfoncement max (tuiles).
          const maxDrop = (el.enfoncement!=null ? el.enfoncement : 5) * TILE;
          const sinkSpd = el.vitesse_chute!=null ? el.vitesse_chute : 0.7;
          const riseSpd = el.vitesse_remontee!=null ? el.vitesse_remontee : 1.2;
          sinkers.push({...r, baseY:r.y, maxDrop, sinkSpd, riseSpd, drop:0, pressed:false });
          break;
        }
        case 'pilon': {
          // bloc ecraseur a cycle vertical automatique. r.y/r.h = bloc en position
          // HAUTE (repos). 'course' = descente max (tuiles). period = cycle complet
          // (frames), phase = decalage initial. Solide marchable + ecrasement mortel.
          const course = (el.course!=null ? el.course : 4) * TILE;
          const period = el.period!=null ? el.period : 150;
          const phase  = el.phase!=null  ? el.phase  : 0;
          pistons.push({ x:r.x, w:r.w, h:r.h, topY:r.y, botY:r.y+course,
                         period, phase, y:r.y, prevY:r.y });
          break;
        }
        case 'bloc_fragile':
          // bloc solide DESTRUCTIBLE par le souffle du dragon ou la boule de Matteo.
          // (distinct de bloc_brique/bloc_fissure, cassables a la tete.)
          fragileBlocks.push({...r, alive:true}); break;
        case 'sceau':
          // sceau secret a activer au contact. Les 3 ouvrent la porte de crypte.
          seals.push({...r, id:el.id, active:false}); break;
        case 'porte_crypte':
          // porte solide tant que les 3 sceaux ne sont pas tous actifs. S'ouvre alors.
          cryptDoor = {...r, open:false}; solids.push(cryptDoor); break;
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
          coins.push({...r, taken:false, cond:el.condition||'', id:el.id,
            clear_min: el.clear_min!=null ? el.clear_min*TILE : null,
            clear_max: el.clear_max!=null ? el.clear_max*TILE : null}); break;
        case 'piece_secrete':
          secretCoin = {...r, taken:false, revealed:false, id:el.id, cond:el.condition||'ennemis'}; break;
        case 'ennemi_1': spawnEnemy('walker', r, el); break;
        case 'ennemi_2': spawnEnemy('flyer',  r, el); break;
        case 'ennemi_3': spawnEnemy('caster', r, el); break;
        case 'ennemi_4': spawnEnemy('dasher', r, el); break;
        case 'ennemi_5': spawnEnemy('bomber', r, el); break;
        case 'mat_drapeau':
          flag = {...r, raised:false}; break;
        case 'chateau':
          castle = r; break;
        case 'alcove_secrete':
          decoItems.push({type:'alcove', ...r, plan:'secret'}); break;
        // ── BOSS ──
        case 'boss_louise': {
          const cfg = LEVEL.boss || {};
          boss = {
            x:r.x, y:r.y, w:r.w, h:r.h,
            vx:0, vy:0, onGround:true, facing:-1,
            hp:(cfg.hits_needed||3), hitsNeeded:(cfg.hits_needed||3),
            alive:true, hitFlash:0, invuln:0,
            jumpPeriod:(cfg.jump_period||300), firePeriod:(cfg.fire_period||180),
            jumpTimer:90, fireTimer:120,
            xMin:(cfg.x_min!=null?cfg.x_min*TILE:r.x-200),
            xMax:(cfg.x_max!=null?cfg.x_max*TILE:r.x+200),
            name:cfg.name||'Louise',
            engaged:false   // true seulement quand le joueur entre dans la zone du boss
          };
          break;
        }
        case 'item_calecon':
          calecons.push({...r, id:el.id, taken:false, baseX:r.x, baseY:r.y}); break;
        case 'mur_sortie_boss':
          bossWall = {...r, open:false}; solids.push(bossWall); break;
        default: break;
      }
    }
  }

  augmentLevel();   // [AUGMENT] trampoline zone 5 + secret zone 10 — retirable d'un bloc
  totalEnemies = enemies.filter(e=>e._type).length;

  // [N3] Lier chaque SCEAU au dragon (caster) de sa zone : le sceau ne pourra être
  //      activé que lorsque ce dragon sera mort. On associe au caster le plus proche
  //      horizontalement (les sceaux sont placés sous/près de leur dragon).
  const casters = enemies.filter(e=>e._type==='caster');
  for(const sl of seals){
    let best=null, bestD=Infinity;
    const scx = sl.x + sl.w/2;
    for(const c of casters){
      const d = Math.abs((c.x + c.w/2) - scx);
      if(d < bestD){ bestD = d; best = c; }
    }
    // on ne lie que si un dragon est raisonnablement proche (même zone, < 30 tuiles)
    sl.guard = (best && bestD <= 30*TILE) ? best : null;
  }
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
  // Mécaniques spéciales pilotées par des marqueurs dans les données de niveau :
  //  - fixZone5Trampoline : trampoline caché (niveau 1, _tramp_x)
  //  - fixZone10Secret    : alcôve secrète accroupie (niveau 1, _secret_x)
  // Ces deux fonctions ne s'exécutent QUE si le marqueur correspondant existe.
  // Seul le niveau 1 les porte ; les niveaux 2 et 3 ne sont donc pas affectés.
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
  else if(type==='dasher'){
    // loup : 4 états (idle/telegraphing/dashing/recovering). Charge horizontale
    // vers le joueur quand il entre dans detectionRange. Vitesse de charge tirée
    // de "vitesse" (ex "2.0x charge") ; portée et cooldown raisonnables.
    const dashSpeed = parseVm(el.vitesse) || 3.4;   // px/frame en charge
    enemies.push({ _type:'dasher', x:r.x, y:footY - 22, w:28, h:22,
      vx:0, dashSpeed, detectionRange: 13*TILE, dashCooldown: 90,
      state:'idle', stateTimer:0,
      facing: el.sens_initial==='gauche'?-1:1,
      alive:true, frame:0, tick:0, zMin, zMax });
  }
  else if(type==='bomber'){
    // slime : rebondit en continu (gravité propre), inverse aux bornes/murs.
    const spd = parseVm(el.vitesse) || 0.6;
    enemies.push({ _type:'bomber', x:r.x, y:footY - 25, w:25, h:25,
      vx: spd * (Math.random()<0.5?1:-1), vy:0,
      bounceForce: 6.3, alive:true, frame:0, tick:0, zMin, zMax });
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
  for(const fb of fragileBlocks){
    if(!fb.alive) continue;
    if(aabb(p.x,p.y,p.w,p.h,fb.x,fb.y,fb.w,fb.h)){
      if(p.vx>0) p.x = fb.x - p.w;
      else if(p.vx<0) p.x = fb.x + fb.w;
      p.vx = 0;
    }
  }
}

function collideSolidsY(){
  p.onGround = false;
  // plafond de voûte (thème grotte) : barrière solide en haut. On la place à la
  // partie la plus haute de la roche (depth*0.4) pour ne jamais traverser le dessin.

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
  // Corentin (spikeImmune) : TOUS les pics sont SOLIDES pour lui, il marche dessus.
  // Les autres meurent à la pointe (géré dans update). 3 types : glace, normaux, rétractables.
  if(charDef.spikeImmune){
    for(const s of iceSpikes){
      if(s.dir!=='up') continue;
      if(p.vy>=0 && p.x+p.w>s.x && p.x<s.x+s.w && (p.y+p.h-p.vy) <= s.y+8 && p.y+p.h >= s.y-2){
        p.y = s.y - p.h; p.vy=0; p.onGround=true;
      }
    }
    for(const s of spikes){
      if(p.vy>=0 && p.x+p.w>s.x && p.x<s.x+s.w && (p.y+p.h-p.vy) <= s.y+8 && p.y+p.h >= s.y-2){
        p.y = s.y - p.h; p.vy=0; p.onGround=true;
      }
    }
    for(const rs of retractSpikes){
      if(!rs.out) continue;   // seulement quand le pic est sorti
      if(p.vy>=0 && p.x+p.w>rs.x && p.x<rs.x+rs.w && (p.y+p.h-p.vy) <= rs.y+8 && p.y+p.h >= rs.y-2){
        p.y = rs.y - p.h; p.vy=0; p.onGround=true;
      }
    }
  }
  // Blocs tombants INSTABLES : solides au repos (on peut se poser dessus), mais
  // le contact — par-dessus OU par-dessous — déclenche la chute (shaking -> falling).
  // Pendant la chute, le SOMMET porte encore le joueur ; le bas écrase (mort gérée plus bas).
  for(const f of fallers){
    if(f.state==='gone') continue;
    if(f.state==='idle'){
      // (a) solide par le DESSUS : le joueur posé dessus est porté, et ça déclenche la chute
      if(p.vy>=0 && aabb(p.x,p.y,p.w,p.h,f.x,f.y,f.w,f.h) && (p.y+p.h - p.vy) <= f.y+4){
        p.y = f.y - p.h; p.vy = 0; p.onGround = true;
        f.state='shaking'; f.timer=24;
      }
      // (b) déclenchement classique : le joueur passe DESSOUS
      else if(p.x+p.w > f.x && p.x < f.x+f.w && p.y > f.y){
        f.state='shaking'; f.timer=24;
      }
    }
    // pendant le tremblement aussi, le sommet reste solide (le joueur peut rester posé)
    else if(f.state==='shaking'){
      if(p.vy>=0 && aabb(p.x,p.y,p.w,p.h,f.x,f.y,f.w,f.h) && (p.y+p.h - p.vy) <= f.y+4){
        p.y = f.y - p.h; p.vy = 0; p.onGround = true;
      }
    }
    // sommet = plateforme : le joueur posé dessus descend avec elle (états falling/breaking)
    else if((f.state==='falling'||f.state==='breaking') && p.vy>=0
        && aabb(p.x,p.y,p.w,p.h,f.x,f.y,f.w,f.h) && (p.y+p.h - p.vy) <= f.y + Math.max(4,f.vy+2)){
      p.y = f.y - p.h; p.vy = 0; p.onGround = true;
      if(f.state==='falling') p.y += f.vy;   // suit la descente
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
  // plateformes qui sombrent : appui par le dessus -> marque pressed (mouvement
  // applique dans updateMechanics) ; le joueur suit l'enfoncement.
  for(const sk of sinkers){
    if(p.vy>=0 && aabb(p.x,p.y,p.w,p.h,sk.x,sk.y,sk.w,sk.h) && (p.y+p.h - p.vy) <= sk.y+3){
      p.y = sk.y - p.h; p.vy=0; p.onGround=true; sk.pressed=true;
    }
  }
  // pilons : bloc solide marchable. Appui par le dessus ou butee par le dessous.
  for(const ps of pistons){
    if(aabb(p.x,p.y,p.w,p.h,ps.x,ps.y,ps.w,ps.h)){
      if(p.vy>=0 && (p.y+p.h - p.vy) <= ps.y+3){ p.y=ps.y-p.h; p.vy=0; p.onGround=true; }
      else if(p.vy<0 && (p.y - p.vy) >= ps.y+ps.h-1){ p.y=ps.y+ps.h; p.vy=0; }
    }
  }
  // blocs fragiles : solides tant que vivants (collision pleine par le dessus/dessous)
  for(const fb of fragileBlocks){
    if(!fb.alive) continue;
    if(aabb(p.x,p.y,p.w,p.h,fb.x,fb.y,fb.w,fb.h)){
      if(p.vy>=0 && (p.y+p.h - p.vy) <= fb.y+1){ p.y=fb.y-p.h; p.vy=0; p.onGround=true; }
      else if(p.vy<0 && (p.y - p.vy) >= fb.y+fb.h-1){ p.y=fb.y+fb.h; p.vy=0; }
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
  // stalactites (pics de glace) : idle -> shaking -> falling (LENT) -> brise au sol
  // -> regen (delai) -> idle (reapparait au plafond). Comportement uniforme partout.
  for(const f of fallers){
    if(f.state==='shaking'){ if(--f.timer<=0){ f.state='falling'; f.vy=0; } }
    else if(f.state==='falling'){
      f.vy = Math.min(f.vy + 0.10, 1.8);   // chute LENTE (le joueur a le temps de sauter dessus)
      f.y += f.vy;
      if(f.y + f.h >= GROUND_SURFACE){      // touche le sol -> se brise
        f.y = GROUND_SURFACE - f.h; f.state='breaking'; f.timer=12;
      }
    }
    else if(f.state==='breaking'){ if(--f.timer<=0){ f.state='regen'; f.timer=90; } }
    else if(f.state==='regen'){ if(--f.timer<=0){ f.y=f.baseY; f.vy=0; f.state='idle'; } }
  }
  // pics retractables : etat 'sorti' (mortel) sur la fraction 'duty' de chaque cycle
  mechTick++;
  for(const rs of retractSpikes){
    const t = ((mechTick + rs.phase) % rs.period) / rs.period;  // 0..1 dans le cycle
    rs.out = (t < rs.duty);
  }
  // geysers : hauteur de colonne selon le cycle. Montee rapide, plateau,
  // retombee ; au repos curH=0 (passage libre). Mortel des que curH>0.
  for(const g of geysers){
    const t = ((mechTick + g.phase) % g.period) / g.period;   // 0..1
    if(t < g.duty){
      // phase active : on monte vite (1er quart), plateau, on redescend (dernier quart)
      const a = t / g.duty;                                    // 0..1 dans la phase active
      let f;
      if(a < 0.25)      f = a/0.25;                            // montee
      else if(a > 0.75) f = (1-a)/0.25;                        // retombee
      else              f = 1;                                 // plateau
      g.curH = g.maxH * f;
    } else {
      g.curH = 0;                                              // repos : rien, passage libre
    }
  }
  // plateformes qui sombrent : descendent sous appui, remontent une fois liberees
  for(const sk of sinkers){
    if(sk.pressed){
      sk.drop = Math.min(sk.maxDrop, sk.drop + sk.sinkSpd);
    } else {
      sk.drop = Math.max(0, sk.drop - sk.riseSpd);
    }
    sk.y = sk.baseY + sk.drop;
    sk.pressed = false;   // re-arme a chaque frame ; collideSolidsY le repositionne si appui
  }
  // pilons : cycle vertical automatique entre topY (haut) et botY (bas).
  // profil : descente sur la 1ere moitie, remontee sur la 2e (triangle).
  for(const ps of pistons){
    ps.prevY = ps.y;
    const t = ((mechTick + ps.phase) % ps.period) / ps.period;  // 0..1
    const f = t < 0.5 ? (t/0.5) : (1-(t-0.5)/0.5);              // 0->1->0
    ps.y = ps.topY + (ps.botY - ps.topY) * f;
    ps.descending = (ps.y > ps.prevY + 0.01);
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
    // pics retractables : mortels uniquement quand ils sont SORTIS
    for(const rs of retractSpikes){
      if(rs.out && aabb(p.x,p.y,p.w,p.h,rs.x,rs.y,rs.w,rs.h)){ killPlayer(); return; }
    }
  }
  // pics de glace fixes : la POINTE tue. Corentin (spikeImmune) en est protégé
  // et peut marcher dessus (la collision solide est gérée dans collideSolidsY).
  if(!charDef.spikeImmune){
    for(const s of iceSpikes){
      if(!aabb(p.x,p.y,p.w,p.h,s.x,s.y,s.w,s.h)) continue;
      if(s.dir==='up'){
        if(p.y+p.h > s.y && p.y < s.y+s.h*0.6){ killPlayer(); return; }
      } else {
        if(p.y+p.h > s.y+s.h*0.4 && p.y < s.y+s.h){ killPlayer(); return; }
      }
    }
  }
  // blocs tombants en chute : le bas écrase le joueur ; le sommet sert de plateforme.
  // Mort si la moitié basse du bloc chevauche le corps du joueur, SAUF s'il est
  // posé sur le sommet (tête au-dessus du haut du bloc).
  for(const f of fallers){
    if(f.state!=='falling' && f.state!=='breaking') continue;
    const pointeTop = f.y + f.h*0.45;          // début de la zone mortelle (bas)
    const chevaucheX = p.x+p.w > f.x && p.x < f.x+f.w;
    const chevaucheY = p.y+p.h > pointeTop && p.y < f.y+f.h;   // corps dans la pointe
    const poseSurSommet = (p.y+p.h) <= f.y + 6;                // tête/pieds au-dessus du sommet
    if(chevaucheX && chevaucheY && !poseSurSommet){ killPlayer(); return; }
  }
  // lave — mortelle pour TOUT LE MONDE.
  for(const lv of lava){
    const feet = p.y + p.h;
    if(p.x + p.w > lv.x && p.x < lv.x + lv.w && feet > lv.y + 2){ killPlayer(); return; }
  }
  // geysers — mortels quand la colonne est levee (curH>0). La colonne occupe
  // de (baseY - curH) a baseY, sur la largeur w. Tue tout le monde.
  for(const g of geysers){
    if(g.curH<=0) continue;
    const top = g.baseY - g.curH;
    if(p.x + p.w > g.x && p.x < g.x + g.w && p.y + p.h > top && p.y < g.baseY){ killPlayer(); return; }
  }
  // pilons — ecrasement mortel : si le pilon DESCEND et que son bas mord dans la
  // tete du joueur alors que celui-ci a un appui (ne peut pas s'echapper vers le bas).
  for(const ps of pistons){
    if(!ps.descending) continue;
    const overlapX = (p.x + p.w > ps.x && p.x < ps.x + ps.w);
    const botPiston = ps.y + ps.h;
    // tete du joueur prise sous le bas du pilon, et joueur appuye (onGround)
    if(overlapX && p.onGround && botPiston > p.y + 2 && ps.y < p.y + p.h){ killPlayer(); return; }
  }
  // chute dans un trou (sous le monde)
  if(p.y > GROUND_Y + 40){ killPlayer(); return; }
  // pièces-récompense
  for(const c of coins){
    if(c.taken) continue;
    // la pièce du dragon n'est collectable qu'après sa mort
    if(c.cond && c.cond.indexOf('aerien')>=0 && !c._unlocked) continue;
    // pièce de NETTOYAGE : révélée seulement quand plus aucun ennemi vivant
    // dans la plage [clear_min, clear_max] (en tuiles). Cachée avant.
    if(c.cond && c.cond.indexOf('nettoyer')>=0){
      if(!c._unlocked){
        const cmin=c.clear_min||0, cmax=c.clear_max||0;   // déjà en pixels
        const reste = enemies.some(e=>e.alive && e._type && (e.x+e.w/2)>=cmin && (e.x+e.w/2)<=cmax);
        if(reste) continue;       // encore des ennemis -> pièce cachée
        c._unlocked=true;         // zone nettoyée -> la pièce apparaît
      }
    }
    if(aabb(p.x,p.y,p.w,p.h,c.x,c.y,c.w,c.h)){ c.taken=true; coinCount++; if(window.Audio2) Audio2.sfx('duck'); }
  }
  // sceaux secrets (N3) : activation au contact, UNIQUEMENT si le dragon gardien
  // de la zone est mort. Tant que le dragon vit, le sceau reste inactif (verrouillé).
  for(const sl of seals){
    if(sl.active) continue;
    const gardienMort = !sl.guard || !sl.guard.alive;
    if(gardienMort && aabb(p.x,p.y,p.w,p.h,sl.x,sl.y,sl.w,sl.h)){ sl.active=true; }
  }
  // porte de crypte : s'ouvre (retiree des solides) quand TOUS les sceaux sont actifs.
  if(cryptDoor && !cryptDoor.open && seals.length>0 && seals.every(s=>s.active)){
    cryptDoor.open=true;
    const i=solids.indexOf(cryptDoor);
    if(i>=0) solids.splice(i,1);
  }
  // pièce secrète (hors décompte) : condition selon le niveau.
  //  - 'sceaux'  : révélée quand les 3 sceaux sont actifs (N3, crypte)
  //  - sinon     : révélée quand TOUS les ennemis sont tués (N1/N2)
  if(secretCoin && !secretCoinTaken){
    if(!secretCoin.revealed){
      const bySeals = (secretCoin.cond && secretCoin.cond.indexOf('sceau')>=0);
      if(bySeals){
        if(seals.length>0 && seals.every(s=>s.active)) secretCoin.revealed=true;
      } else if(totalEnemies>0 && enemiesKilled>=totalEnemies){
        secretCoin.revealed=true;
      }
    }
    if(secretCoin.revealed && aabb(p.x,p.y,p.w,p.h,secretCoin.x,secretCoin.y,secretCoin.w,secretCoin.h)){
      if(!secretCoinTaken && window.Audio2){ Audio2.sfx('duck'); setTimeout(()=>Audio2.sfx('duck'),120); }
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

function killPlayer(){ if(!p.dead){ p.dead=true; p.respawnT=50; if(window.Audio2) Audio2.sfx('hurt'); } }

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
  if(window.Audio2){ Audio2.stopMusic(); Audio2.sfx('win'); }
  const te = document.getElementById('end-time');
  if(te) te.textContent = formatTime(timeMs);
  // canards obtenus : 3 emplacements, remplis selon coinCount ; +1 si secret
  const dd = document.getElementById('end-ducks');
  if(dd){
    let html='';
    for(let i=0;i<3;i++) html += '<img src="duck.svg" alt="" class="'+(i<coinCount?'got':'')+'">';
    if(secretCoinTaken) html += '<img src="duck.svg" alt="" class="got" title="Canard secret (vaut 2 canards)" style="filter:hue-rotate(135deg) saturate(1.4) drop-shadow(0 0 7px #1fd6c6)">';
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
    // boule de Matteo -> detruit aussi un bloc fragile (canard zone 10)
    for(const fb of fragileBlocks){
      if(fb.alive && b.x>fb.x && b.x<fb.x+fb.w && b.y>fb.y && b.y<fb.y+fb.h){ fb.alive=false; b.life=0; break; }
    }
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
  if(window.Audio2) Audio2.sfx('enemy');
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
      // OBSTACLE frontal : un solide qui barre la route à hauteur du corps -> demi-tour
      const frontX = e.vx>0 ? e.x+e.w+1 : e.x-1;
      for(const s of solids){
        if(frontX>=s.x && frontX<s.x+s.w && e.y+e.h-2 > s.y && e.y < s.y+s.h){ e.vx*=-1; break; }
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
    else if(e._type==='dasher'){
      // loup : idle -> telegraphing (40f) -> dashing (30f) -> recovering (cooldown).
      // Charge horizontale vers le joueur. Confiné à [zMin,zMax].
      if(e.state==='idle'){
        e.vx=0;
        if(!p.dead){
          const dx=(p.x+p.w/2)-(e.x+e.w/2);
          e.facing = dx>0?1:-1;
          if(Math.abs(dx) < e.detectionRange){ e.state='telegraphing'; e.stateTimer=40; }
        }
      } else if(e.state==='telegraphing'){
        e.vx=0;
        if(--e.stateTimer<=0){ e.state='dashing'; e.stateTimer=30; e.vx=e.facing*e.dashSpeed; }
      } else if(e.state==='dashing'){
        e.x+=e.vx;
        // bornes de zone : rebond + demi-tour
        if(e.x<=e.zMin){ e.x=e.zMin; e.vx*=-1; e.facing*=-1; }
        if(e.x+e.w>=e.zMax){ e.x=e.zMax-e.w; e.vx*=-1; e.facing*=-1; }
        if(--e.stateTimer<=0){ e.state='recovering'; e.stateTimer=e.dashCooldown; e.vx=0; }
      } else if(e.state==='recovering'){
        e.vx=0;
        if(--e.stateTimer<=0) e.state='idle';
      }
    }
    else if(e._type==='bomber'){
      // slime : rebond perpétuel (gravité propre), inverse aux bornes/plateformes.
      e.vy += 0.18; e.y += e.vy; e.x += e.vx;
      // rebond sur le sol (surface monde)
      const floor = GROUND_SURFACE - e.h;
      if(e.y >= floor){ e.y = floor; e.vy = -e.bounceForce; }
      // rebond sur les plateformes (par le dessus, en descente)
      if(e.vy>0){
        for(const pl of platforms){
          const prevBottom = e.y + e.h - e.vy;
          if(e.x+e.w>pl.x && e.x<pl.x+pl.w && prevBottom<=pl.y && e.y+e.h>=pl.y){
            e.y = pl.y - e.h; e.vy = -e.bounceForce; break;
          }
        }
      }
      // confinement horizontal : inverse aux bornes
      if(e.x<=e.zMin){ e.x=e.zMin; if(e.vx<0) e.vx*=-1; }
      if(e.x+e.w>=e.zMax){ e.x=e.zMax-e.w; if(e.vx>0) e.vx*=-1; }
    }
  }

  // Projectiles
  for(const pr of monsterProjectiles){ pr.x+=pr.vx; pr.y+=pr.vy; pr.life--;
    if(++pr.tick>6){pr.frame=(pr.frame+1)%4;pr.tick=0;} }
  // souffle de dragon -> detruit un bloc fragile au contact (canard zone 10)
  for(let i=monsterProjectiles.length-1;i>=0;i--){
    const pr=monsterProjectiles[i];
    for(const fb of fragileBlocks){
      if(fb.alive && aabb(pr.x,pr.y,10,10,fb.x,fb.y,fb.w,fb.h)){
        fb.alive=false; monsterProjectiles.splice(i,1); break;
      }
    }
  }
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
  updateBoss();
  checkLevelInteractions();
  updateCamera();
}

/* ── [BOSS] Mise à jour complète du combat de Louise ──────────────── */
const CALECON_RANGE = 3*TILE;      // portée de ramassage (3 cases)
const CALECON_THROW_DIST = 3*TILE; // portée du lancer (3 cases)
const BOSS_FIRE_SPEED = 2.0;       // vitesse des flammes

function updateBoss(){
  if(!boss) return;

  pickupCalecons();   // ramassage automatique des caleçons au contact

  // --- ENGAGEMENT : le nom + la barre de vie ne s'affichent qu'une fois le joueur
  //     entré dans la zone du boss (l'arène). Seuil = bord gauche de l'aire du boss.
  if(!boss.engaged){
    const seuil = boss.xMin - 2*TILE;          // un poil avant la plage de patrouille
    if(p.x + p.w >= seuil) boss.engaged = true;
  }

  // --- MUR DE SORTIE : solide tant que Louise vit. À sa défaite, il s'abaisse
  //     (animation : s'enfonce dans le sol), puis devient franchissable.
  if(bossWall && bossWall.opening && !bossWall.open){
    bossWall.openT++;
    const k = Math.min(1, bossWall.openT / bossWall.openDur);
    const newH = Math.max(0, bossWall.fullH * (1 - k));
    bossWall.y = bossWall.fullY + (bossWall.fullH - newH);   // le bas reste ancré, le haut descend
    bossWall.h = newH;
    if(k >= 1){
      bossWall.open = true;
      const i = solids.indexOf(bossWall);
      if(i>=0) solids.splice(i,1);   // franchissable une fois l'animation terminée
    }
  }

  if(boss.alive){
    // --- GRAVITÉ + déplacement vertical ---
    boss.vy = Math.min(boss.vy + 0.22, 8);
    boss.y += boss.vy;
    boss.onGround = false;
    // collision sol + plateformes (atterrissage par le dessus)
    const bb={x:boss.x,y:boss.y,w:boss.w,h:boss.h};
    // sol plein
    if(boss.y + boss.h > GROUND_SURFACE){ boss.y = GROUND_SURFACE - boss.h; boss.vy=0; boss.onGround=true; }
    // plateformes suspendues
    for(const pf of platforms){
      if(boss.vy>=0 && bb.x+boss.w>pf.x && bb.x<pf.x+pf.w){
        const prevBottom = boss.y + boss.h - boss.vy;
        if(prevBottom<=pf.y+2 && boss.y+boss.h>=pf.y){ boss.y=pf.y-boss.h; boss.vy=0; boss.onGround=true; }
      }
    }

    // --- SAUT périodique aléatoire (toutes les ~jumpPeriod frames) ---
    if(boss.onGround && --boss.jumpTimer<=0){
      boss.jumpTimer = boss.jumpPeriod + Math.floor((Math.random()-0.5)*60);
      // cible horizontale aléatoire dans sa zone (gauche/droite)
      const targetX = boss.xMin + Math.random()*(boss.xMax - boss.xMin - boss.w);
      const dx = targetX - boss.x;
      boss.vx = Math.max(-2.6, Math.min(2.6, dx*0.04));
      boss.facing = dx<0 ? -1 : 1;
      // impulsion de saut (assez haute pour atteindre les plateformes)
      boss.vy = -6.6;
      boss.onGround = false;
    }

    // --- déplacement horizontal pendant le saut, confiné à la zone ---
    boss.x += boss.vx;
    if(boss.x < boss.xMin){ boss.x = boss.xMin; boss.vx=0; }
    if(boss.x + boss.w > boss.xMax){ boss.x = boss.xMax - boss.w; boss.vx=0; }
    if(boss.onGround) boss.vx *= 0.8;  // friction à l'atterrissage

    // --- FEU ciblé périodique (toutes les ~firePeriod frames) ---
    if(!p.dead && --boss.fireTimer<=0){
      boss.fireTimer = boss.firePeriod;
      const ox=boss.x+boss.w/2, oy=boss.y+boss.h*0.45;
      const tdx=(p.x+p.w/2)-ox, tdy=(p.y+p.h/2)-oy;
      const tlen=Math.sqrt(tdx*tdx+tdy*tdy)||1;
      bossProjectiles.push({x:ox,y:oy,vx:(tdx/tlen)*BOSS_FIRE_SPEED,vy:(tdy/tlen)*BOSS_FIRE_SPEED,life:240,frame:0,tick:0});
    }
    if(boss.hitFlash>0) boss.hitFlash--;
    if(boss.invuln>0) boss.invuln--;
  }

  // --- FLAMMES de Louise : déplacement + mort du joueur au contact ---
  for(const f of bossProjectiles){ f.x+=f.vx; f.y+=f.vy; f.life--; if(++f.tick>6){f.frame=(f.frame+1)%4;f.tick=0;} }
  bossProjectiles = bossProjectiles.filter(f=>f.life>0);
  if(!p.dead){
    for(let i=bossProjectiles.length-1;i>=0;i--){
      const f=bossProjectiles[i];
      if(aabb(p.x,p.y,p.w,p.h,f.x-5,f.y-5,10,10)){ bossProjectiles.splice(i,1); killPlayer(); return; }
    }
  }

  // --- CALEÇONS en vol (lancés par le joueur, trajectoire en ARC parabolique) ---
  for(const s of caleconShots){ s.vy+=0.07; s.x+=s.vx; s.y+=s.vy; s.life--; }
  for(let i=caleconShots.length-1;i>=0;i--){
    const s=caleconShots[i];
    // touche le boss ?
    if(boss.alive && boss.invuln<=0 && aabb(s.x,s.y,s.w,s.h,boss.x,boss.y,boss.w,boss.h)){
      caleconShots.splice(i,1);
      boss.hp--; boss.hitFlash=24; boss.invuln=30;
      if(boss.hp<=0) defeatBoss();
      continue;
    }
    // fin de vie, sortie d'écran ou retombée au sol/lave -> disparaît
    if(s.life<=0 || s.x<0 || s.x>LEVEL.longueur*TILE || s.y>GROUND_SURFACE){ caleconShots.splice(i,1); }
  }

  // --- ANTI-BLOCAGE : si plus aucun caleçon disponible et boss vivant, respawn des 5 ---
  if(boss.alive){
    const dispo = carriedCalecons + calecons.filter(c=>!c.taken).length + caleconShots.length;
    if(dispo===0){
      for(const c of calecons) c.taken=false;
      carriedCalecons=0;
    }
  }
}

/* Lancer un caleçon — touche d'action (KeyF). Trajectoire en ARC parabolique,
   identique à la boule de feu de Mattéo. Le ramassage est AUTOMATIQUE (pickupCalecons). */
function caleconAction(){
  if(!boss) return;
  if(carriedCalecons>0){
    carriedCalecons--;
    const dir=p.facing||1;
    if(window.Audio2) Audio2.sfx('throw');
    caleconShots.push({x:p.x+p.w/2, y:p.y+p.h*0.35, w:14, h:10,
                       vx:3.6*dir, vy:-2.3, life:300});   // mêmes paramètres que shootBall (Mattéo)
  }
}

/* Ramassage AUTOMATIQUE au contact : tout caleçon non pris qui chevauche le joueur
   est ramassé immédiatement (pas besoin d'une touche). */
function pickupCalecons(){
  if(!boss || p.dead) return;
  for(const c of calecons){
    if(c.taken) continue;
    if(aabb(p.x,p.y,p.w,p.h,c.x,c.y,c.w,c.h)){ c.taken=true; carriedCalecons++; }
  }
}

/* Défaite du boss : déclenche l'animation d'abaissement du mur + canard du boss. */
function defeatBoss(){
  boss.alive=false; bossDefeated=true;
  if(bossWall){
    // ABAISSEMENT ANIMÉ : le mur s'enfonce dans le sol sur ~36 frames, puis
    // devient franchissable (retiré des solides à la fin de l'animation).
    bossWall.opening=true;
    bossWall.openT=0;
    bossWall.openDur=36;
    bossWall.fullH=bossWall.h;
    bossWall.fullY=bossWall.y;
  }
  bossProjectiles=[];                // les flammes restantes s'éteignent
  // le canard de parcours du boss apparaît sur place
  coins.push({x:boss.x+boss.w/2-8, y:boss.y, w:16, h:16, taken:false, cond:'', id:399, _unlocked:true});
}

/* Le mur de sortie agit comme un solide tant qu'il n'est pas ouvert. */
function bossWallSolid(){
  return (bossWall && !bossWall.open) ? bossWall : null;
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
  themeTick++;
  // ciel dégradé (couleurs du thème)
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,THEME.sky[0]); g.addColorStop(1,THEME.sky[1]);
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  // lueur de lave en bas de l'écran (thème château)
  if(THEME.glow){
    const lg=ctx.createLinearGradient(0,H-60,0,H);
    const pulse=0.12+0.06*Math.sin(themeTick*0.05);
    lg.addColorStop(0,'rgba(255,80,20,0)');
    lg.addColorStop(1,'rgba(255,90,20,'+pulse.toFixed(3)+')');
    ctx.fillStyle=lg; ctx.fillRect(0,H-60,W,60);
  }

  // voûte rocheuse en haut de l'écran (thème grotte) — roche déchiquetée :
  // profil en dents OBLIQUES irrégulières (pas de créneaux verticaux) + stalactites
  // massives + grain. Déterministe par position monde (figé, défile avec la caméra).
  if(THEME.ceiling){
    const C=THEME.ceiling, base=C.depth;
    const hash = n => { n=(n<<13)^n; return ((n*(n*n*15731+789221)+1376312589)&0x7fffffff)/0x7fffffff; };
    // Profondeur de la voûte à une position MONDE (px). Source unique partagée
    // avec la collision (ceilingDepthAtWorld, défini au niveau module).
    const STEP=10;
    // hauteur du bord rocheux à une position monde wx. La dentelure est de faible
    // amplitude (relief léger) pour ne pas casser la pente douce des transitions.
    function ceilEdgeWorld(wx){
      const cell = Math.round(wx/STEP);
      const d = ceilingDepthAtWorld(wx);
      // base = 78% de la profondeur ; dentelure = petit relief fixe (en px, pas
      // proportionnel à d, sinon les zones basses ont des dents énormes)
      return d*0.78 + hash(cell)*7 + hash(cell*7+3)*4;
    }
    const c0=Math.floor(camX/STEP)-1, c1=Math.floor((camX+W)/STEP)+1;
    const pts=[];
    for(let c=c0;c<=c1;c++){ const wx=c*STEP; pts.push([wx-camX, ceilEdgeWorld(wx)]); }
    // masse profonde
    ctx.fillStyle=C.rockDeep;
    ctx.beginPath(); ctx.moveTo(pts[0][0],0);
    for(const p of pts) ctx.lineTo(p[0],p[1]);
    ctx.lineTo(pts[pts.length-1][0],0); ctx.closePath(); ctx.fill();
    // couche claire (relief)
    ctx.fillStyle=C.rock;
    ctx.beginPath(); ctx.moveTo(pts[0][0],0);
    for(const p of pts) ctx.lineTo(p[0], p[1]*0.82);
    ctx.lineTo(pts[pts.length-1][0],0); ctx.closePath(); ctx.fill();
    // arête sombre sur le bord oblique
    ctx.strokeStyle=C.edge; ctx.lineWidth=1.5; ctx.beginPath();
    pts.forEach((p,i)=> i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
    ctx.stroke(); ctx.lineWidth=1;
    // STALACTITES décoratives massives, sous certains creux
    for(let c=c0;c<=c1;c++){
      const r=hash(c*3+99);
      if(r<0.5) continue;
      const wx=c*STEP;
      const x = wx - camX + (hash(c+11)*8-4);
      const baseY = ceilEdgeWorld(wx)*0.82;
      const dloc = ceilingDepthAtWorld(wx);
      const len = dloc*0.4 + r*dloc*0.5;
      const w = 7 + (r*8|0);
      ctx.fillStyle=C.rockDeep;
      ctx.beginPath();
      ctx.moveTo(x-w/2, baseY); ctx.lineTo(x, baseY+len); ctx.lineTo(x+w/2, baseY); ctx.closePath(); ctx.fill();
      ctx.fillStyle=C.rock;
      ctx.beginPath();
      ctx.moveTo(x-w/2, baseY); ctx.lineTo(x-w/6, baseY+len*0.92); ctx.lineTo(x, baseY); ctx.closePath(); ctx.fill();
      ctx.strokeStyle=C.edge; ctx.beginPath();
      ctx.moveTo(x-w/2, baseY); ctx.lineTo(x, baseY+len); ctx.lineTo(x+w/2, baseY); ctx.stroke();
    }
    // GRAIN minéral : taches sombres/claires dans la masse
    for(let c=c0*2;c<=c1*2;c++){
      const r=hash(c*5+555); const wx=c*(STEP/2); const x=wx-camX;
      const yMax=ceilEdgeWorld(wx)*0.7; const gy=4+r*yMax;
      if(gy<yMax){ ctx.fillStyle = r>0.55?'rgba(255,255,255,.06)':'rgba(0,0,0,.20)'; ctx.fillRect(x,gy,2,2); }
    }
  }

  // décor parallax (dispatch par type)
  for(const d of decoItems){
    const par = d.plan==='fond'?0.35 : d.plan==='secret'?1 : 0.6;
    const sx = d.x - camX*par;
    if(sx+d.w < -40 || sx > W+40) continue;
    drawDecoItem(d, sx);
  }

  // braises montantes (thème château) — particules procédurales
  if(THEME.glow) drawEmbers();
}

/* Rendu d'un élément de décor selon son type (commun à tous les thèmes). */
function drawDecoItem(d, sx){
  switch(d.type){
    // ── PLAINE ──
    case 'deco_nuage':
      ctx.fillStyle='rgba(255,255,255,0.85)';
      ctx.fillRect(sx,d.y,d.w,d.h); ctx.fillRect(sx+6,d.y-6,d.w-12,6); ctx.fillRect(sx-6,d.y+4,d.w+12,d.h-8);
      break;
    case 'deco_colline': {
      const cx=sx+d.w/2, baseY=H, apexY=GROUND_SURFACE-88, shoulder=apexY+40;
      ctx.fillStyle='#62b552';
      ctx.beginPath(); ctx.moveTo(sx,baseY); ctx.lineTo(sx+d.w*0.20,shoulder);
      ctx.quadraticCurveTo(cx,apexY,sx+d.w*0.80,shoulder); ctx.lineTo(sx+d.w,baseY);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle='#73c662';
      ctx.beginPath(); ctx.moveTo(sx+d.w*0.20,shoulder);
      ctx.quadraticCurveTo(cx,apexY,sx+d.w*0.80,shoulder);
      ctx.quadraticCurveTo(cx,apexY+22,sx+d.w*0.20,shoulder); ctx.closePath(); ctx.fill();
      break;
    }
    case 'deco_buisson':
      ctx.fillStyle='#3f9a36'; ctx.fillRect(sx,d.y,d.w,d.h); ctx.fillRect(sx+3,d.y-4,d.w-6,4);
      break;
    // ── GROTTE ──
    case 'deco_stalactite': {
      // pend du plafond : triangle gris-violet pointe vers le bas
      const w=d.w, h=d.h;
      ctx.fillStyle='#534661';
      ctx.beginPath(); ctx.moveTo(sx,d.y); ctx.lineTo(sx+w,d.y); ctx.lineTo(sx+w/2,d.y+h); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#6a5c78'; ctx.beginPath(); ctx.moveTo(sx+w*0.2,d.y); ctx.lineTo(sx+w*0.5,d.y+h*0.7); ctx.lineTo(sx+w*0.5,d.y); ctx.closePath(); ctx.fill();
      break;
    }
    case 'deco_stalagmite': {
      const w=d.w, h=d.h, by=GROUND_SURFACE;
      ctx.fillStyle='#463a52';
      ctx.beginPath(); ctx.moveTo(sx,by); ctx.lineTo(sx+w,by); ctx.lineTo(sx+w/2,by-h); ctx.closePath(); ctx.fill();
      break;
    }
    case 'deco_cristal': {
      // cristal luminescent violet/cyan, légère pulsation
      const w=d.w, h=d.h, pulse=0.6+0.4*Math.sin(themeTick*0.06 + sx*0.1);
      ctx.fillStyle='rgba(120,90,200,'+(0.25*pulse).toFixed(2)+')'; // halo
      ctx.fillRect(sx-3,d.y-3,w+6,h+6);
      ctx.fillStyle='#9a6cf0';
      ctx.beginPath(); ctx.moveTo(sx+w/2,d.y); ctx.lineTo(sx+w,d.y+h*0.4); ctx.lineTo(sx+w*0.6,d.y+h); ctx.lineTo(sx+w*0.4,d.y+h); ctx.lineTo(sx,d.y+h*0.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#c8a0ff'; ctx.fillRect(sx+w*0.45,d.y+h*0.2,2,h*0.5);
      break;
    }
    case 'deco_champignon':
      ctx.fillStyle='#6a4a72'; ctx.fillRect(sx+d.w*0.4,d.y+d.h*0.4,d.w*0.2,d.h*0.6);
      ctx.fillStyle='#b06cc0'; ctx.fillRect(sx,d.y,d.w,d.h*0.5);
      break;
    // ── CHÂTEAU ──
    case 'deco_torche': {
      // torche murale : support + flamme vacillante
      ctx.fillStyle='#2a1c14'; ctx.fillRect(sx+d.w*0.4,d.y+d.h*0.3,d.w*0.2,d.h*0.7);
      const fl=Math.sin(themeTick*0.3+sx)*1.5;
      ctx.fillStyle='#ff7a18'; ctx.fillRect(sx+d.w*0.25+fl,d.y,d.w*0.5,d.h*0.4);
      ctx.fillStyle='#ffd23a'; ctx.fillRect(sx+d.w*0.35+fl,d.y+2,d.w*0.3,d.h*0.25);
      ctx.fillStyle='#fff2b0'; ctx.fillRect(sx+d.w*0.45+fl,d.y+3,d.w*0.1,d.h*0.15);
      break;
    }
    case 'deco_banniere': {
      ctx.fillStyle='#5a1418'; ctx.fillRect(sx,d.y,d.w,d.h);
      ctx.fillStyle='#7a1c22'; ctx.fillRect(sx+2,d.y,d.w-4,d.h-4);
      ctx.fillStyle='#c89048'; ctx.fillRect(sx+d.w*0.4,d.y+d.h*0.3,d.w*0.2,d.h*0.2);
      break;
    }
    case 'deco_colonne':
      ctx.fillStyle='#3a2c30'; ctx.fillRect(sx,d.y,d.w,d.h);
      ctx.fillStyle='#4e3c40'; ctx.fillRect(sx+2,d.y,3,d.h);
      ctx.fillStyle='#241a1c'; ctx.fillRect(sx+d.w-4,d.y,3,d.h);
      break;
    case 'alcove':
      ctx.fillStyle='rgba(20,18,40,0.55)'; ctx.fillRect(d.x-camX,d.y,d.w,d.h);
      break;
  }
}

/* Braises montantes (thème château). Particules légères, purement décoratives. */
function drawEmbers(){
  if(embers.length<40 && Math.random()<0.4){
    embers.push({x:Math.random()*W, y:H+4, vy:-(0.3+Math.random()*0.6), life:120+Math.random()*80, r:1+Math.random()*1.5});
  }
  for(const e of embers){ e.y+=e.vy; e.x+=Math.sin(e.y*0.05)*0.2; e.life--; }
  embers = embers.filter(e=>e.life>0 && e.y>-4);
  for(const e of embers){
    const a=Math.min(1,e.life/60)*0.8;
    ctx.fillStyle='rgba(255,'+(120+Math.floor(Math.random()*60))+',30,'+a.toFixed(2)+')';
    ctx.fillRect(e.x,e.y,e.r,e.r);
  }
}

/* Pièce-canard : petit canard pixel inspiré du logo (corps doré, bec orange).
   Dessiné dans le cadre (x,y,w,h) ; les proportions suivent une grille 16×16. */
function drawDuckCoin(x,y,w,h,variant){
  const u=w/16, v=h/16, px=(a,b,c,d,col)=>{ ctx.fillStyle=col; ctx.fillRect(x+a*u,y+b*v,c*u,d*v); };
  // variante 'secret' : canard BLEU TURQUOISE (différencie les canards secrets de chaque niveau)
  const turq = variant==='secret';
  const BODY  = turq ? '#1fd6c6' : '#ffcc22';
  const BODY_D= turq ? '#16b3a6' : '#f0b81e';
  const OUT   = turq ? '#dffbf7' : '#fff7e6';
  const BEAK  = turq ? '#ff9a1f' : '#ff9a1f';   // bec orange dans les deux cas
  const EYE='#3a2a10';
  // contour clair (halo derrière le corps)
  px(3,7,11,8,OUT);
  px(8,2,5,6,OUT);
  // corps + tête
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
    } else if(s.ice){
      // structure de GLACE (colonne, mur, escalier) : solide mais look glacé
      const g=ctx.createLinearGradient(s.x,0,s.x+s.w,0);
      g.addColorStop(0,'#6ab3dd'); g.addColorStop(0.5,'#a3dbf2'); g.addColorStop(1,'#5aa8d8');
      ctx.fillStyle=g; ctx.fillRect(s.x,s.y,s.w,s.h);
      // facettes verticales (reflets de glace)
      ctx.fillStyle='rgba(255,255,255,0.25)';
      for(let rx=s.x+3; rx<s.x+s.w; rx+=12) ctx.fillRect(rx,s.y+2,3,s.h-4);
      // arête givrée en haut, base plus sombre
      ctx.fillStyle='#eaf7ff'; ctx.fillRect(s.x,s.y,s.w,3);
      ctx.fillStyle='rgba(40,90,130,0.5)'; ctx.fillRect(s.x,s.y+s.h-2,s.w,2);
      ctx.strokeStyle='rgba(90,160,210,.7)'; ctx.strokeRect(s.x+.5,s.y+.5,s.w-1,s.h-1);
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
      // sol terreux (couleurs du thème)
      const G=THEME.ground;
      ctx.fillStyle=G.soil; ctx.fillRect(s.x,s.y,s.w,s.h);
      ctx.fillStyle=G.soilDeep; ctx.fillRect(s.x,s.y+TILE,s.w,s.h-TILE);
      ctx.fillStyle=G.top; ctx.fillRect(s.x,s.y,s.w,G.topH);
      ctx.fillStyle=G.topDot;
      for(let gx=s.x;gx<s.x+s.w;gx+=8) ctx.fillRect(gx,s.y+4,4,2);
    } else if(s.slab){
      // DALLE de séparation : pleine et solide, mais texturée comme les PLATEFORMES
      // du niveau (mêmes teintes marron) pour une séparation nette et homogène.
      const PL=THEME.platform, B=THEME.block;
      ctx.fillStyle=PL.base; ctx.fillRect(s.x,s.y,s.w,s.h);
      ctx.fillStyle=PL.top;  ctx.fillRect(s.x,s.y,s.w,Math.min(5,s.h));
      if(s.h>5){ ctx.fillStyle=B.bottom; ctx.fillRect(s.x,s.y+s.h-2,s.w,2); }
      ctx.strokeStyle=B.edge; ctx.strokeRect(s.x+.5,s.y+.5,s.w-1,s.h-1);
    } else {
      // bloc (couleurs du thème)
      const B=THEME.block;
      ctx.fillStyle=B.face; ctx.fillRect(s.x,s.y,s.w,s.h);
      ctx.fillStyle=B.top; ctx.fillRect(s.x,s.y,s.w,3);
      ctx.fillStyle=B.bottom; ctx.fillRect(s.x,s.y+s.h-3,s.w,3);
      ctx.strokeStyle=B.edge; ctx.strokeRect(s.x+.5,s.y+.5,s.w-1,s.h-1);
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
      const PL=THEME.platform;
      ctx.fillStyle=PL.base; ctx.fillRect(pf.x,pf.y+3,pf.h>0?pf.w:0,pf.h-3);
      ctx.fillStyle=PL.top; ctx.fillRect(pf.x,pf.y,pf.w,5);
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
    if(f.state==='gone'||f.state==='regen'||f.x+f.w<x0||f.x>x1) continue;
    let ox=0; if(f.state==='shaking') ox=(Math.random()-.5)*2;
    // Apparence selon le thème : la GROTTE (niveau 2) garde les stalactites de glace
    // — ses zones s'appellent "stalactites". Les autres thèmes (plaine, château)
    // affichent un vrai BLOC de pierre — leurs zones s'appellent "blocs tombants".
    const asIce = (LEVEL && LEVEL.theme === 'grotte');
    if(asIce){
      const cx=f.x+f.w/2+ox, top=f.y, w=f.w, h=f.h;
      if(f.state==='breaking'){
        ctx.fillStyle='#bfe8ff';
        for(let i=0;i<5;i++){ const a=i/5*Math.PI*2; ctx.fillRect(cx+Math.cos(a)*8-1, f.y+h-2+Math.sin(a)*4, 3,3); }
        continue;
      }
      // stalactite de glace : triangle pointe en bas
      const grad=ctx.createLinearGradient(0,top,0,top+h);
      grad.addColorStop(0,'#dff4ff'); grad.addColorStop(0.5,'#8fd0ef'); grad.addColorStop(1,'#5aa8d8');
      ctx.fillStyle=grad;
      ctx.beginPath();
      ctx.moveTo(cx-w/2, top); ctx.lineTo(cx+w/2, top); ctx.lineTo(cx, top+h); ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.moveTo(cx-w/2,top); ctx.lineTo(cx, top+h); ctx.lineTo(cx-w/6, top+h*0.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(90,160,210,.7)'; ctx.beginPath();
      ctx.moveTo(cx-w/2,top); ctx.lineTo(cx,top+h); ctx.lineTo(cx+w/2,top); ctx.stroke();
      ctx.fillStyle='#eaf7ff'; ctx.fillRect(cx-w/2, top, w, 2);
    } else {
      const x=f.x+ox, top=f.y, w=f.w, h=f.h;
      const S=THEME.stone;
      if(f.state==='breaking'){
        ctx.fillStyle=S.brick;
        for(let i=0;i<5;i++){ const a=i/5*Math.PI*2; ctx.fillRect(x+w/2+Math.cos(a)*8-1, f.y+h-2+Math.sin(a)*4, 3,3); }
        continue;
      }
      // BLOC tombant : pavé de pierre (carré) avec relief
      ctx.fillStyle=S.face; ctx.fillRect(x, top, w, h);
      ctx.fillStyle=S.top;    ctx.fillRect(x, top, w, 3);
      ctx.fillStyle=S.bottom; ctx.fillRect(x, top+h-3, w, 3);
      ctx.fillStyle=S.brick;
      ctx.fillRect(x+2, top+5, w-4, 2);
      ctx.fillRect(x+2, top+h-7, w-4, 2);
      ctx.strokeStyle=S.edge; ctx.strokeRect(x+.5, top+.5, w-1, h-1);
    }
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
  // pics de glace fixes (stalagmites/stalactites) : dégradé glacé, pointe selon dir
  for(const s of iceSpikes){
    if(s.x+s.w<x0||s.x>x1) continue;
    const cx=s.x+s.w/2;
    const grad=ctx.createLinearGradient(0,s.y,0,s.y+s.h);
    if(s.dir==='up'){ grad.addColorStop(0,'#5aa8d8'); grad.addColorStop(0.5,'#8fd0ef'); grad.addColorStop(1,'#dff4ff'); }
    else            { grad.addColorStop(0,'#dff4ff'); grad.addColorStop(0.5,'#8fd0ef'); grad.addColorStop(1,'#5aa8d8'); }
    ctx.fillStyle=grad;
    ctx.beginPath();
    if(s.dir==='up'){ // pointe en haut
      ctx.moveTo(s.x, s.y+s.h); ctx.lineTo(cx, s.y); ctx.lineTo(s.x+s.w, s.y+s.h);
    } else {          // pointe en bas
      ctx.moveTo(s.x, s.y); ctx.lineTo(cx, s.y+s.h); ctx.lineTo(s.x+s.w, s.y);
    }
    ctx.closePath(); ctx.fill();
    // reflet clair
    ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.beginPath();
    if(s.dir==='up'){ ctx.moveTo(s.x+2,s.y+s.h); ctx.lineTo(cx,s.y); ctx.lineTo(cx-2,s.y+s.h*0.5); }
    else            { ctx.moveTo(s.x+2,s.y); ctx.lineTo(cx,s.y+s.h); ctx.lineTo(cx-2,s.y+s.h*0.5); }
    ctx.closePath(); ctx.fill();
    // base givrée (côté ancrage)
    ctx.fillStyle='#eaf7ff';
    if(s.dir==='up') ctx.fillRect(s.x, s.y+s.h-2, s.w, 2);
    else             ctx.fillRect(s.x, s.y, s.w, 2);
  }
  // lave : nappe rougeoyante animee (surface ondulante + bulles)
  for(const lv of lava){
    if(lv.x+lv.w<x0||lv.x>x1) continue;
    const pulse = 0.5 + 0.5*Math.sin(themeTick*0.04);
    // masse de lave (degrade simule par deux bandes)
    ctx.fillStyle='#7a1402'; ctx.fillRect(lv.x,lv.y,lv.w,lv.h);
    ctx.fillStyle='#c22806'; ctx.fillRect(lv.x,lv.y,lv.w,Math.min(lv.h,10));
    // surface ondulante claire
    ctx.fillStyle='#ff7a18';
    for(let sx2=lv.x; sx2<lv.x+lv.w; sx2+=8){
      const wob = Math.sin((sx2*0.12)+themeTick*0.08)*2;
      ctx.fillRect(sx2, lv.y+wob, 8, 4);
    }
    // liseré incandescent qui pulse
    ctx.fillStyle='rgba(255,'+(180+Math.floor(pulse*60))+',60,0.9)';
    ctx.fillRect(lv.x, lv.y-1, lv.w, 2);
    // bulles occasionnelles
    if(((themeTick+((lv.x|0)*7))%48) < 6){
      const bx=lv.x + ((themeTick*3+ (lv.x|0)) % Math.max(1,lv.w));
      ctx.fillStyle='rgba(255,210,90,0.8)'; ctx.fillRect(bx, lv.y+3, 3, 3);
    }
  }
  // pics retractables : dessines sortis (pleins) ou rentres (souches au sol)
  for(const rs of retractSpikes){
    if(rs.x+rs.w<x0||rs.x>x1) continue;
    const STEP=12;                       // largeur d'une pointe (elargi : 8->12)
    const n=Math.max(1,Math.floor(rs.w/STEP));
    if(rs.out){
      for(let i=0;i<n;i++){
        const px=rs.x+i*STEP;
        ctx.fillStyle='#6a5048'; ctx.beginPath();
        ctx.moveTo(px,rs.y+rs.h); ctx.lineTo(px+STEP/2,rs.y); ctx.lineTo(px+STEP,rs.y+rs.h); ctx.fill();
        ctx.fillStyle='#b89078'; ctx.beginPath();
        ctx.moveTo(px+1,rs.y+rs.h); ctx.lineTo(px+STEP/2,rs.y+3); ctx.lineTo(px+STEP/2,rs.y+rs.h); ctx.fill();
      }
      ctx.fillStyle='#3a2c28'; ctx.fillRect(rs.x,rs.y+rs.h-2,rs.w,2);
    } else {
      // rentres : fente sombre au ras du sol (indice de danger imminent)
      ctx.fillStyle='#2a201c'; ctx.fillRect(rs.x, rs.y+rs.h-3, rs.w, 3);
      ctx.fillStyle='#1a1410';
      for(let i=0;i<n;i++) ctx.fillRect(rs.x+i*STEP+4, rs.y+rs.h-3, 3, 3);
    }
  }
  // geysers : colonne de lave qui jaillit (mortelle si curH>0). Au repos,
  // une bouche sombre au sol signale l'emplacement (lecture du danger).
  for(const g of geysers){
    if(g.x+g.w<x0||g.x>x1) continue;
    // bouche au sol (toujours visible)
    ctx.fillStyle='#2a0e06'; ctx.fillRect(g.x, g.baseY-3, g.w, 3);
    ctx.fillStyle='#5a1408'; ctx.fillRect(g.x+2, g.baseY-2, g.w-4, 2);
    if(g.curH>0){
      const top = g.baseY - g.curH;
      // colonne
      ctx.fillStyle='#7a1402'; ctx.fillRect(g.x, top, g.w, g.curH);
      ctx.fillStyle='#c22806'; ctx.fillRect(g.x+1, top, g.w-2, g.curH);
      // coeur clair central qui ondule
      ctx.fillStyle='#ff7a18';
      const cw=Math.max(2,g.w*0.4);
      ctx.fillRect(g.x+(g.w-cw)/2, top, cw, g.curH);
      // crete incandescente + gouttes
      ctx.fillStyle='#ffd23a';
      const wob=Math.sin(themeTick*0.2)*2;
      ctx.fillRect(g.x+2+wob, top, g.w-4, 4);
      ctx.fillStyle='rgba(255,160,40,0.85)';
      ctx.fillRect(g.x+g.w/2-1, top-4-((themeTick*2)%6), 3, 4);
    }
  }
  // plateformes qui sombrent : dalle de pierre fissuree, enfoncement visible
  for(const sk of sinkers){
    if(sk.x+sk.w<x0||sk.x>x1) continue;
    const sinking = sk.drop>0.5;
    ctx.fillStyle = sinking ? '#4a2c26' : '#5a3a30';
    ctx.fillRect(sk.x, sk.y+3, sk.w, sk.h-3);
    ctx.fillStyle = sinking ? '#6a4438' : '#7a5040';
    ctx.fillRect(sk.x, sk.y, sk.w, 5);
    // fissures (indice : c'est une dalle instable)
    ctx.strokeStyle='rgba(20,8,4,.6)'; ctx.beginPath();
    ctx.moveTo(sk.x+sk.w*0.3,sk.y); ctx.lineTo(sk.x+sk.w*0.4,sk.y+sk.h);
    ctx.moveTo(sk.x+sk.w*0.7,sk.y); ctx.lineTo(sk.x+sk.w*0.62,sk.y+sk.h); ctx.stroke();
    // liseré d'alerte quand elle s'enfonce
    if(sinking){ ctx.fillStyle='rgba(255,90,30,'+(0.3+0.3*Math.sin(themeTick*0.3)).toFixed(2)+')';
      ctx.fillRect(sk.x, sk.y, sk.w, 2); }
  }
  // pilons : bloc ecraseur metallique, dents en partie basse, ombre quand il descend
  for(const ps of pistons){
    if(ps.x+ps.w<x0||ps.x>x1) continue;
    ctx.fillStyle='#3c3c46'; ctx.fillRect(ps.x,ps.y,ps.w,ps.h);
    ctx.fillStyle='#54545e'; ctx.fillRect(ps.x,ps.y,ps.w,4);
    ctx.fillStyle='#26262e'; ctx.fillRect(ps.x,ps.y+ps.h-6,ps.w,6);
    // dents d'ecrasement en bas
    ctx.fillStyle='#1a1a20';
    for(let dx=ps.x+2; dx<ps.x+ps.w-2; dx+=8){
      ctx.beginPath(); ctx.moveTo(dx,ps.y+ps.h); ctx.lineTo(dx+3,ps.y+ps.h-5); ctx.lineTo(dx+6,ps.y+ps.h); ctx.fill();
    }
    // rivets
    ctx.fillStyle='#6a6a76';
    ctx.fillRect(ps.x+3,ps.y+3,2,2); ctx.fillRect(ps.x+ps.w-5,ps.y+3,2,2);
    // lueur d'alerte rouge quand il descend
    if(ps.descending){ ctx.fillStyle='rgba(255,60,30,'+(0.25+0.25*Math.sin(themeTick*0.4)).toFixed(2)+')';
      ctx.fillRect(ps.x,ps.y+ps.h-2,ps.w,2); }
  }
  // blocs fragiles : pierre claire lezardee (signale qu'elle peut etre detruite)
  for(const fb of fragileBlocks){
    if(!fb.alive||fb.x+fb.w<x0||fb.x>x1) continue;
    ctx.fillStyle='#8a6a52'; ctx.fillRect(fb.x,fb.y,fb.w,fb.h);
    ctx.fillStyle='#a4886e'; ctx.fillRect(fb.x,fb.y,fb.w,3);
    ctx.fillStyle='#5e4636'; ctx.fillRect(fb.x,fb.y+fb.h-3,fb.w,3);
    // lezardes marquees
    ctx.strokeStyle='rgba(30,16,8,.7)'; ctx.beginPath();
    ctx.moveTo(fb.x+fb.w*0.5,fb.y); ctx.lineTo(fb.x+fb.w*0.35,fb.y+fb.h*0.5); ctx.lineTo(fb.x+fb.w*0.55,fb.y+fb.h);
    ctx.moveTo(fb.x+fb.w*0.7,fb.y+fb.h*0.2); ctx.lineTo(fb.x+fb.w*0.8,fb.y+fb.h*0.7); ctx.stroke();
    ctx.strokeStyle='rgba(40,40,50,.5)'; ctx.strokeRect(fb.x+.5,fb.y+.5,fb.w-1,fb.h-1);
  }
  // sceaux : rune circulaire gravee. Eteinte (inactive) ou rougeoyante (active).
  for(const sl of seals){
    if(sl.x+sl.w<x0||sl.x>x1) continue;
    const cx=sl.x+sl.w/2, cy=sl.y+sl.h/2, r=Math.min(sl.w,sl.h)*0.42;
    // socle de pierre
    ctx.fillStyle='#2c2024'; ctx.fillRect(sl.x,sl.y,sl.w,sl.h);
    ctx.strokeStyle='#4a3640'; ctx.strokeRect(sl.x+.5,sl.y+.5,sl.w-1,sl.h-1);
    if(sl.active){
      const pulse=0.6+0.4*Math.sin(themeTick*0.12);
      ctx.fillStyle='rgba(255,120,40,'+(0.3*pulse).toFixed(2)+')';
      ctx.fillRect(sl.x+1,sl.y+1,sl.w-2,sl.h-2);
      ctx.strokeStyle='#ffb84a'; ctx.lineWidth=2;
    } else if(sl.guard && sl.guard.alive){
      // VERROUILLÉ : le dragon gardien vit encore -> rune éteinte, teinte froide
      ctx.strokeStyle='#3a4a5a'; ctx.lineWidth=1;
    } else {
      // ACTIVABLE : dragon mort -> légère lueur d'invite (bleu-vert pulsé)
      const pulse=0.5+0.5*Math.sin(themeTick*0.1);
      ctx.fillStyle='rgba(90,200,180,'+(0.18*pulse).toFixed(2)+')';
      ctx.fillRect(sl.x+1,sl.y+1,sl.w-2,sl.h-2);
      ctx.strokeStyle='#7ad0c0'; ctx.lineWidth=1;
    }
    // cercle + croix runique
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx-r,cy); ctx.lineTo(cx+r,cy);
    ctx.moveTo(cx,cy-r); ctx.lineTo(cx,cy+r); ctx.stroke();
    ctx.lineWidth=1;
  }
  // porte de crypte : portail SCELLÉ mystérieux — pierre ancienne gravée de runes,
  // halo arcane pulsant, cristaux de sceaux qui s'illuminent à mesure qu'on les active.
  if(cryptDoor && !cryptDoor.open && !(cryptDoor.x+cryptDoor.w<x0||cryptDoor.x>x1)){
    const d=cryptDoor;
    const total=seals.length||3, on=seals.filter(s=>s.active).length;
    const pulse=0.5+0.5*Math.sin(themeTick*0.06);
    // masse de pierre sombre, légèrement bombée (dégradé vertical)
    const g=ctx.createLinearGradient(d.x,d.y,d.x,d.y+d.h);
    g.addColorStop(0,'#1a1320'); g.addColorStop(0.5,'#241830'); g.addColorStop(1,'#140e1a');
    ctx.fillStyle=g; ctx.fillRect(d.x,d.y,d.w,d.h);
    // grand bloc central encastré
    ctx.fillStyle='#2a1d38'; ctx.fillRect(d.x+3,d.y+3,d.w-6,d.h-6);
    // arche en ogive suggérée en haut (deux biseaux sombres)
    ctx.fillStyle='#160f1e';
    ctx.beginPath(); ctx.moveTo(d.x+3,d.y+3); ctx.lineTo(d.x+d.w/2,d.y-2); ctx.lineTo(d.x+d.w-3,d.y+3); ctx.closePath(); ctx.fill();
    // veines runiques verticales gravées, faiblement lumineuses (mauve)
    ctx.strokeStyle='rgba(150,90,220,'+(0.25+0.35*pulse).toFixed(2)+')'; ctx.lineWidth=1;
    for(let vx=d.x+8; vx<d.x+d.w-6; vx+=10){
      ctx.beginPath();
      ctx.moveTo(vx,d.y+10);
      ctx.lineTo(vx+3,d.y+d.h*0.35);
      ctx.lineTo(vx-2,d.y+d.h*0.6);
      ctx.lineTo(vx+2,d.y+d.h-10);
      ctx.stroke();
    }
    // cercle runique central (halo arcane) qui respire
    const cxp=d.x+d.w/2, cyp=d.y+d.h*0.42, rr=Math.min(d.w,d.h)*0.18;
    ctx.strokeStyle='rgba(170,110,240,'+(0.3+0.5*pulse).toFixed(2)+')'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(cxp,cyp,rr,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cxp,cyp,rr*0.55,0,Math.PI*2); ctx.stroke();
    ctx.lineWidth=1;
    // CRISTAUX de sceaux (un par sceau) : éteints = pierre froide, allumés = ambre vif lumineux
    const gw=7, gap=5, totW=total*gw+(total-1)*gap, gx=cxp-totW/2, gy=d.y+d.h*0.68;
    for(let i=0;i<total;i++){
      const lit=i<on, bx=gx+i*(gw+gap);
      if(lit){
        ctx.fillStyle='rgba(255,184,74,'+(0.5+0.5*pulse).toFixed(2)+')';
        ctx.fillRect(bx-1,gy-1,gw+2,8);          // halo
        ctx.fillStyle='#ffd479';
      } else { ctx.fillStyle='#2c2438'; }
      // petit losange/cristal
      ctx.beginPath();
      ctx.moveTo(bx+gw/2,gy-2); ctx.lineTo(bx+gw,gy+3); ctx.lineTo(bx+gw/2,gy+8); ctx.lineTo(bx,gy+3);
      ctx.closePath(); ctx.fill();
    }
    // liseré de pierre claire et contour profond
    ctx.fillStyle='rgba(120,90,160,0.35)'; ctx.fillRect(d.x+3,d.y+3,d.w-6,2);
    ctx.strokeStyle='#0c0810'; ctx.strokeRect(d.x+.5,d.y+.5,d.w-1,d.h-1);
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
    if(c.cond && c.cond.indexOf('nettoyer')>=0 && !c._unlocked) continue;  // cachée tant que zone non nettoyée
    drawDuckCoin(c.x, c.y + Math.sin(Date.now()/260)*1.5, c.w, c.h);
  }
  // CANARD SECRET (bleu turquoise) : dessiné uniquement une fois révélé (3 sceaux actifs)
  if(secretCoin && !secretCoinTaken && secretCoin.revealed && !(secretCoin.x+secretCoin.w<x0||secretCoin.x>x1)){
    drawDuckCoin(secretCoin.x, secretCoin.y + Math.sin(Date.now()/260)*1.5, secretCoin.w, secretCoin.h, 'secret');
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
  // boss (Louise) : dessiné APRÈS le joueur et indépendamment de sa mort,
  // pour rester visible pendant la mort/respawn du joueur dans l'arène.
  drawBossLayer();
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
    if(e._type==='dasher') drawDasherSprite(ex,ey,e.frame,e.facing,e.w,e.h,e.state);
    if(e._type==='bomber') drawBomberSprite(ex,ey,e.frame,e.w,e.h);
  }
}

/* ── [BOSS] Rendu de Louise, caleçons et flammes ──────────────────── */
function drawBossLayer(){
  if(!boss) return;
  // flammes de Louise
  for(const f of bossProjectiles){
    const fx=Math.round(f.x), fy=Math.round(f.y), gl=[0,2,1,3][f.frame];
    ctx.fillStyle='#ffee00'; ctx.fillRect(fx-4,fy-4,8,8);
    ctx.fillStyle='#ff8800'; ctx.fillRect(fx-5,fy-5,10,10);
    ctx.fillStyle='#ff3300'; ctx.fillRect(fx-7+gl,fy-3,4,6); ctx.fillRect(fx+3-gl,fy-3,4,6);
    ctx.fillStyle='#fff8cc'; ctx.fillRect(fx-2,fy-2,4,4);
  }
  // caleçons au sol/plateformes (non pris) — design blanc très visible
  for(const c of calecons){ if(!c.taken) drawCalecon(Math.round(c.x), Math.round(c.y), c.w, c.h); }
  // caleçons en vol
  for(const s of caleconShots){ drawCalecon(Math.round(s.x-s.w/2), Math.round(s.y-s.h/2), s.w, s.h); }
  // LOUISE
  if(boss.alive || boss.hitFlash>0){
    const bx=Math.round(boss.x), by=Math.round(boss.y);
    ctx.save();
    ctx.translate(bx+boss.w/2, by+boss.h);
    if(boss.facing===-1) ctx.scale(-1,1);
    // agrandissement boss : le sprite Louise (drawH 38) ramené à la hauteur voulue,
    // puis RÉDUIT de 70% (facteur 0.30) — le boss était rendu trop grand.
    const BOSS_VISUAL_SCALE = 0.30;
    const sc = boss.h / (38*0.62) * BOSS_VISUAL_SCALE;
    ctx.scale(sc, sc);
    // flash blanc quand touchée
    if(boss.hitFlash>0 && Math.floor(boss.hitFlash/4)%2===0){
      ctx.globalAlpha=1;
    }
    const air = !boss.onGround;
    drawCharacterSprite(7, false, air, [[0,0],[4,0]]);
    ctx.restore();
    if(boss.hitFlash>0){ ctx.save(); ctx.globalAlpha=0.4; ctx.fillStyle='#fff';
      ctx.fillRect(bx,by,boss.w,boss.h); ctx.restore(); }
  }
  // caleçon porté par le joueur (petit indicateur au-dessus de la tête)
  if(carriedCalecons>0){
    const ix=Math.round(p.x+p.w/2-7), iy=Math.round(p.y-14);
    drawCalecon(ix, iy, 14, 10);
    if(carriedCalecons>1){ ctx.fillStyle='#fff'; ctx.font='bold 9px monospace';
      ctx.fillText('\u00d7'+carriedCalecons, ix+15, iy+9); }
  }
}

/* Dessin d'un caleçon blanc, lisible (slip avec ceinture et ouverture). */
function drawCalecon(x,y,w,h){
  ctx.fillStyle='#ffffff'; ctx.fillRect(x,y,w,h);                 // corps blanc
  ctx.fillStyle='#e8e8e8'; ctx.fillRect(x,y+h-3,w,3);             // ombre bas
  ctx.fillStyle='#d8d8d8'; ctx.fillRect(x+w/2-1,y+2,2,h-2);       // entrejambe (deux jambes)
  ctx.fillStyle='#cfd4e0'; ctx.fillRect(x,y,w,2);                 // ceinture élastique
  ctx.fillStyle='#1a1a1a'; ctx.fillRect(x,y,w,1); ctx.fillRect(x,y,1,h); ctx.fillRect(x+w-1,y,1,h); ctx.fillRect(x,y+h-1,w,1); // contour
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

  // ── BARRE DE VIE DU BOSS (centrée en haut) — seulement une fois le joueur
  //    entré dans la zone du boss (sinon rien ne s'affiche au reste du niveau).
  if(boss && boss.engaged){
    const bw=Math.min(220, W*0.5), bx=(W-bw)/2, byb=10;
    // nom
    ctx.font='bold 12px monospace'; ctx.textAlign='center';
    ctx.fillStyle='#ff5a6e'; ctx.fillText(boss.name.toUpperCase(), W/2, byb+0);
    ctx.textAlign='left';
    // cadre
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(bx-3, byb+4, bw+6, 12);
    ctx.fillStyle='#3a1418'; ctx.fillRect(bx, byb+6, bw, 8);
    // remplissage proportionnel aux touches restantes
    const frac = Math.max(0, boss.hp) / boss.hitsNeeded;
    ctx.fillStyle = boss.alive ? '#e23046' : '#444';
    ctx.fillRect(bx, byb+6, Math.round(bw*frac), 8);
    // séparateurs des segments (hits)
    ctx.fillStyle='#1a0a0c';
    for(let i=1;i<boss.hitsNeeded;i++){ const sx=bx+Math.round(bw*i/boss.hitsNeeded); ctx.fillRect(sx-1,byb+6,1,8); }
    if(!boss.alive){ ctx.fillStyle='#9f9'; ctx.font='bold 11px monospace'; ctx.textAlign='center';
      ctx.fillText('VAINCUE', W/2, byb+25); ctx.textAlign='left'; }
  }
}

/* ── [NOYAU] Boucle principale (pas fixe 60 Hz, indépendant de l'écran) ──
   La simulation avance par pas fixes de 1/60 s quel que soit le taux de
   rafraîchissement (60/120/144 Hz...). Sans cela le jeu suit la fréquence de
   l'écran et tourne trop vite sur les écrans rapides. */
console.log('[CCB] engine.js chargé — boucle pas-fixe 60 Hz (build vitesse-fix-2)');
const FRAME_MS = 1000/60;
let _accum = 0;
let _prev = 0;
const _clock = () => (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();

function loop(){
  requestAnimationFrame(loop);
  const t = _clock();
  let elapsed = t - _prev;
  _prev = t;
  if(elapsed > 250) elapsed = 250;          // garde anti-rattrapage explosif
  _accum += elapsed;
  let steps = 0;
  while(_accum >= FRAME_MS && steps < 5){    // autant de pas de 1/60 s que nécessaire
    update();
    _accum -= FRAME_MS;
    steps++;
  }
  if(steps === 5) _accum = 0;
  // rendu une fois par frame d'affichage
  ctx.save();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.scale(S,S);
  drawBg();
  drawWorld();
  drawHUD();
  ctx.restore();
}

/* ── Démarrage (appelé par index.html après sélection du perso) ── */
let _started = false;
function startGame(){
  if(_started) return; _started=true;
  resize();
  buildLevel();
  placePlayer();
  runFrames = 0; runActive = true;
  _prev = _clock(); _accum = 0;
  loop();
}
window.startGame = startGame;


/* Exposition pour index.html */
window.restartLevel = restartLevel;
