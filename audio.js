/* =====================================================================
   audio.js — Audio entièrement SYNTHÉTISÉ (Web Audio API).
   Aucun fichier externe : musiques chiptune + effets générés par oscillateurs.
   Mélodies originales dans l'esprit "platformer rétro" (pas de copie d'œuvre).

   API publique (window.Audio2) :
     Audio2.unlock()            -> débloque l'AudioContext (à appeler sur 1re interaction)
     Audio2.playMusic(level)    -> lance la boucle musicale du niveau (1,2,3)
     Audio2.stopMusic()         -> arrête la musique
     Audio2.sfx(name)           -> joue un effet : 'enemy','duck','win','unlock',
                                    'jump','hurt','throw','click'
     Audio2.setEnabled(bool)    -> son global on/off (persisté)
     Audio2.setVolume(0..1)     -> volume général (persisté)
     Audio2.isEnabled()/volume()-> lecture des réglages
===================================================================== */
window.Audio2 = (function(){
  const LS_ON = 'ccb_snd_on', LS_VOL = 'ccb_snd_vol';
  let ctx = null;
  let master = null;          // gain général (réglage volume)
  let sfxGain = null;         // sous-bus des effets sonores

  let enabled = (localStorage.getItem(LS_ON) ?? '1') === '1';
  let volume  = parseFloat(localStorage.getItem(LS_VOL) ?? '0.7');

  function ensureCtx(){
    if(ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    master = ctx.createGain();  master.gain.value = enabled ? volume : 0;  master.connect(ctx.destination);
    sfxGain = ctx.createGain();   sfxGain.gain.value = 0.9;  sfxGain.connect(master);
    return ctx;
  }

  // Débloque l'audio (appelé au 1er clic/tap — exigence des navigateurs).
  function unlock(){
    ensureCtx();
    if(ctx && ctx.state === 'suspended') ctx.resume();
  }

  // ── Brique de base : une note (oscillateur + enveloppe) ──
  function note(freq, t0, dur, {type='square', gain=0.2, bus=null, attack=0.005, release=0.06}={}){
    if(!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.setValueAtTime(gain, t0 + Math.max(attack, dur - release));
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus || sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  // bruit court (percussion / explosion) via buffer aléatoire
  function noise(t0, dur, {gain=0.2, bus=null, hp=false}={}){
    if(!ctx) return;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i] = (Math.random()*2-1) * (1 - i/n);  // decay linéaire
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(bus || sfxGain);
    src.start(t0);
  }

  // Notes (fréquences en Hz) — gamme tempérée
  const N = {
    C3:130.81,D3:146.83,E3:164.81,F3:174.61,G3:196.00,A3:220.00,B3:246.94,
    C4:261.63,D4:293.66,E4:329.63,F4:349.23,G4:392.00,A4:440.00,B4:493.88,
    C5:523.25,D5:587.33,E5:659.25,F5:698.46,G5:783.99,A5:880.00,
    R:0  // silence
  };


  // ── Fichiers musicaux (si présents dans le dépôt) ──
  // Clé de piste : 0 = menu/accueil, 1/2/3 = niveaux. On tente plusieurs extensions.
  const MUSIC_FILES = {
    0: ['menu.mp3','menu.ogg'],
    1: ['niveau1.mp3','niveau1.ogg'],
    2: ['niveau2.mp3','niveau2.ogg'],
    3: ['niveau3.mp3','niveau3.ogg']
  };
  let audioEl = null;          // élément <audio> en cours (musique fichier)
  let usingFile = false;
  let playbackStarted = false; // true seulement quand el.play() a RÉELLEMENT démarré
                               // (une promesse play() rejetée par la politique
                               //  d'autoplay laisse ce drapeau à false)

  function tryPlayFile(key){
    const list = MUSIC_FILES[key]; if(!list) return false;
    // crée un <audio> et tente de charger la 1re source jouable
    const el = document.createElement('audio');
    el.loop = true; el.preload = 'auto';
    // volume géré par le réglage global (musique un peu en retrait des effets)
    el.volume = (enabled ? volume : 0) * 0.55;
    let idx = 0;
    function tryNext(){
      if(idx >= list.length){ return; }   // aucun fichier jouable -> silence (plus de synthèse)
      el.src = list[idx++];
      el.play().then(()=>{
        usingFile = true; audioEl = el; playbackStarted = true;
      }).catch((err)=>{
        // Deux cas d'échec possibles :
        //  - format/fichier absent -> on tente la source suivante
        //  - autoplay bloqué (NotAllowedError, pas de geste utilisateur) -> il ne
        //    sert à rien d'essayer les autres formats : on garde l'élément prêt,
        //    on laisse playbackStarted=false pour que playMusic puisse réessayer
        //    au prochain geste sans se court-circuiter.
        if(err && err.name === 'NotAllowedError'){
          usingFile = true; audioEl = el; playbackStarted = false;
        } else {
          tryNext();
        }
      });
    }
    el.addEventListener('error', tryNext);
    tryNext();
    return true;
  }

  let currentTrack = -1;   // 0 menu, 1/2/3 niveaux, -1 aucun

  function playMusic(level){
    // 'level' : 1/2/3 pour un niveau, 0 pour le menu/accueil
    ensureCtx();
    const key = (level===0?0:level);
    // On ne court-circuite QUE si la piste demandée est déjà en cours de lecture
    // effective. Si une piste avait été "demandée" mais bloquée par l'autoplay
    // (playbackStarted=false), on doit pouvoir la relancer.
    if(currentTrack === key && playbackStarted) return;
    // Cas : même piste demandée, mais lecture jamais démarrée (autoplay bloqué).
    // On tente simplement de relancer l'élément déjà prêt, sans tout reconstruire.
    if(currentTrack === key && !playbackStarted && audioEl){
      if(ctx && ctx.state==='suspended') ctx.resume();
      audioEl.play().then(()=>{ playbackStarted = true; }).catch(()=>{});
      return;
    }
    stopMusic();
    currentTrack = key;
    if(ctx && ctx.state==='suspended') ctx.resume();
    // on lit le fichier MP3 correspondant à la piste (menu ou niveau)
    usingFile = false;
    tryPlayFile(key);
  }
  function stopMusic(){
    currentTrack = -1;
    playbackStarted = false;
    if(audioEl){ try{ audioEl.pause(); }catch(e){} audioEl.src=''; audioEl = null; }
    usingFile = false;
  }

  // ── EFFETS SONORES ──
  function sfx(name){
    ensureCtx(); if(!ctx) return;
    if(ctx.state==='suspended') ctx.resume();
    const t = ctx.currentTime;
    switch(name){
      case 'enemy':   // ennemi tué : "pop" descendant + bruit (volume réduit de 30%)
        note(420, t, 0.10, {type:'square', gain:0.154});
        note(280, t+0.06, 0.10, {type:'square', gain:0.14});
        noise(t, 0.12, {gain:0.07});
        break;
      case 'duck':    // canard ramassé : arpège ascendant clair
        note(N.E5, t, 0.08, {type:'square', gain:0.18});
        note(N.G5, t+0.07, 0.08, {type:'square', gain:0.18});
        note(N.C5*2, t+0.14, 0.12, {type:'square', gain:0.18});
        break;
      case 'win':     // niveau terminé : petite fanfare (volume réduit de 30%)
        [['C5',0],['E5',0.12],['G5',0.24],['C5',0.40],['G5',0.40],['C5',0.40]].forEach(([nm,dt])=>
          note(N[nm]||523, t+dt, 0.22, {type:'square', gain:0.14}));
        break;
      case 'unlock':  // perso débloqué : montée triomphale
        ['C4','E4','G4','C5','E5','G5'].forEach((nm,i)=>
          note(N[nm], t+i*0.09, 0.16, {type:'square', gain:0.18}));
        break;
      case 'jump':    // saut : petit chirp montant
        if(ctx){ const o=ctx.createOscillator(), g=ctx.createGain();
          o.type='square'; o.frequency.setValueAtTime(300,t); o.frequency.exponentialRampToValueAtTime(620,t+0.12);
          g.gain.setValueAtTime(0.16,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.14);
          o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.16); }
        break;
      case 'hurt':    // dégâts / mort : chute dissonante
        if(ctx){ const o=ctx.createOscillator(), g=ctx.createGain();
          o.type='sawtooth'; o.frequency.setValueAtTime(380,t); o.frequency.exponentialRampToValueAtTime(70,t+0.35);
          g.gain.setValueAtTime(0.22,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.4);
          o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.42); }
        noise(t, 0.2, {gain:0.12});
        break;
      case 'throw':   // lancer de caleçon : "whoosh" court
        if(ctx){ const o=ctx.createOscillator(), g=ctx.createGain();
          o.type='triangle'; o.frequency.setValueAtTime(520,t); o.frequency.exponentialRampToValueAtTime(180,t+0.18);
          g.gain.setValueAtTime(0.16,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.2);
          o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.22); }
        break;
      case 'click':   // clic menu : tic doux et grave (moins agressif à l'oreille)
        note(300, t, 0.06, {type:'triangle', gain:0.12, attack:0.004, release:0.05});
        note(200, t+0.015, 0.05, {type:'sine', gain:0.08});
        break;
    }
  }

  // ── RÉGLAGES (persistés) ──
  function applyMaster(){
    if(master) master.gain.value = enabled ? volume : 0;
    if(audioEl) audioEl.volume = (enabled ? volume : 0) * 0.55;   // musique-fichier suit le réglage
  }
  function setEnabled(b){
    enabled = !!b; localStorage.setItem(LS_ON, enabled?'1':'0'); ensureCtx(); applyMaster();
    // si on coupe le son, on met la musique-fichier en pause ; si on réactive, on relance la piste courante
    if(audioEl){ if(!enabled){ try{audioEl.pause();}catch(e){} } else { try{audioEl.play();}catch(e){} } }
  }
  function setVolume(v){ volume = Math.max(0, Math.min(1, v)); localStorage.setItem(LS_VOL, String(volume)); ensureCtx(); applyMaster(); }
  function isEnabled(){ return enabled; }
  function getVolume(){ return volume; }

  return { unlock, playMusic, stopMusic, sfx, setEnabled, setVolume, isEnabled, volume:getVolume };
})();
