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
  let musicGain = null;       // sous-bus musique (un peu plus bas que les sfx)
  let sfxGain = null;
  let enabled = (localStorage.getItem(LS_ON) ?? '1') === '1';
  let volume  = parseFloat(localStorage.getItem(LS_VOL) ?? '0.7');
  let musicTimer = null;      // setTimeout de la boucle
  let musicStop = false;
  let currentLevel = 0;

  function ensureCtx(){
    if(ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    master = ctx.createGain();  master.gain.value = enabled ? volume : 0;  master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.55; musicGain.connect(master);
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

  /* ── MÉLODIES par niveau (mélodie + basse), en pas de croche ──
     Niveau 1 : enjoué, sautillant (prairie/donjon léger).
     Niveau 2 : plus aventureux, tempo soutenu.
     Niveau 3 : sombre/tendu (forge volcanique), mineur. */
  const SONGS = {
    1:{ tempo:150, lead:['E4','E4','R','E4','R','C4','E4','R','G4','R','R','R','G3','R','R','R',
                          'C4','R','R','G3','R','R','E3','R','R','A3','R','B3','R','A3','G3','R'],
        bass:['C3','R','C3','R','G3','R','G3','R','C3','R','C3','R','G3','R','G3','R'] },
    2:{ tempo:168, lead:['A3','C4','E4','A4','E4','C4','A3','R','G3','B3','D4','G4','D4','B3','G3','R',
                          'F3','A3','C4','F4','C4','A3','F3','R','E3','G3','B3','E4','D4','C4','B3','R'],
        bass:['A3','R','E3','R','F3','R','C3','R','D3','R','A3','R','E3','R','E3','R'] },
    3:{ tempo:132, lead:['A3','R','C4','R','A3','R','E3','R','F3','R','A3','R','G3','R','E3','R',
                          'A3','R','A3','C4','D4','R','C4','R','B3','R','G3','R','A3','R','R','R'],
        bass:['A3','A3','R','A3','F3','F3','R','F3','G3','G3','R','G3','E3','E3','R','E3'],
        type:'sawtooth' }
  };

  function scheduleMusic(level){
    if(!ctx || musicStop) return;
    const song = SONGS[level] || SONGS[1];
    const spb = 60 / song.tempo / 2;     // durée d'une croche
    const t0 = ctx.currentTime + 0.06;
    const leadType = song.type || 'square';
    // mélodie
    song.lead.forEach((nm,i)=>{
      const f = N[nm]; if(f) note(f, t0 + i*spb, spb*0.92, {type:leadType, gain:0.16, bus:musicGain});
    });
    // basse (2x plus lente)
    song.bass.forEach((nm,i)=>{
      const f = N[nm]; if(f) note(f/2 || f, t0 + i*spb*2, spb*1.8, {type:'triangle', gain:0.22, bus:musicGain});
    });
    const loopLen = song.lead.length * spb;
    musicTimer = setTimeout(()=>scheduleMusic(level), loopLen*1000);
  }

  function playMusic(level){
    ensureCtx(); if(!ctx) return;
    if(currentLevel === level && !musicStop) return;  // déjà en cours
    stopMusic();
    musicStop = false; currentLevel = level;
    if(ctx.state==='suspended') ctx.resume();
    scheduleMusic(level);
  }
  function stopMusic(){
    musicStop = true; currentLevel = 0;
    if(musicTimer){ clearTimeout(musicTimer); musicTimer = null; }
  }

  // ── EFFETS SONORES ──
  function sfx(name){
    ensureCtx(); if(!ctx) return;
    if(ctx.state==='suspended') ctx.resume();
    const t = ctx.currentTime;
    switch(name){
      case 'enemy':   // ennemi tué : "pop" descendant + bruit
        note(420, t, 0.10, {type:'square', gain:0.22});
        note(280, t+0.06, 0.10, {type:'square', gain:0.20});
        noise(t, 0.12, {gain:0.10});
        break;
      case 'duck':    // canard ramassé : arpège ascendant clair
        note(N.E5, t, 0.08, {type:'square', gain:0.18});
        note(N.G5, t+0.07, 0.08, {type:'square', gain:0.18});
        note(N.C5*2, t+0.14, 0.12, {type:'square', gain:0.18});
        break;
      case 'win':     // niveau terminé : petite fanfare
        [['C5',0],['E5',0.12],['G5',0.24],['C5',0.40],['G5',0.40],['C5',0.40]].forEach(([nm,dt])=>
          note(N[nm]||523, t+dt, 0.22, {type:'square', gain:0.2}));
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
      case 'click':   // clic menu : tic court
        note(660, t, 0.05, {type:'square', gain:0.14});
        break;
    }
  }

  // ── RÉGLAGES (persistés) ──
  function applyMaster(){ if(master) master.gain.value = enabled ? volume : 0; }
  function setEnabled(b){ enabled = !!b; localStorage.setItem(LS_ON, enabled?'1':'0'); ensureCtx(); applyMaster(); }
  function setVolume(v){ volume = Math.max(0, Math.min(1, v)); localStorage.setItem(LS_VOL, String(volume)); ensureCtx(); applyMaster(); }
  function isEnabled(){ return enabled; }
  function getVolume(){ return volume; }

  return { unlock, playMusic, stopMusic, sfx, setEnabled, setVolume, isEnabled, volume:getVolume };
})();
