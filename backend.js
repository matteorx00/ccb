/* =====================================================================
   backend.js — Comptes + scores (speed run)

   DEUX MODES :
   • Si vous renseignez SUPABASE_URL et SUPABASE_KEY ci-dessous,
     les comptes et les records sont PARTAGÉS entre tous les joueurs.
   • Sinon, repli automatique sur le stockage local du navigateur
     (vos comptes/scores restent sur votre seul appareil) — pratique
     pour tester immédiatement sans rien configurer.

   ⚠️ Sécurité : le mot de passe n'offre AUCUNE protection réelle
   (jeu entre amis). Ne jamais y mettre un vrai mot de passe personnel.
===================================================================== */

/* ▼▼▼ À REMPLIR APRÈS AVOIR CRÉÉ VOTRE PROJET SUPABASE ▼▼▼ */
const SUPABASE_URL = "https://iejvxworjurrcbctcqsh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllanZ4d29yanVycmNiY3RjcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODI4ODIsImV4cCI6MjA5Njc1ODg4Mn0.LYxL_ezNHydDLEaCFBtdJir4WzkDQ2cUoZBl1ETB9Zs";
/* ▲▲▲ laisser vide pour le mode local ▲▲▲ */

const Backend = (() => {
  const useRemote = !!(SUPABASE_URL && SUPABASE_KEY);
  // Les nouvelles clés sb_publishable_ ne doivent PAS être envoyées dans
  // l'en-tête Authorization (uniquement dans "apikey"). Les anciennes clés
  // anon (eyJ...) acceptent les deux. On détecte le format pour s'adapter.
  const isNewKey = /^sb_(publishable|secret)_/.test(SUPABASE_KEY);

  /* ---------- Helpers REST Supabase ---------- */
  async function sb(path, opts={}){
    const headers = {
      "apikey": SUPABASE_KEY,
      "Content-Type": "application/json",
      "Prefer": opts.prefer || "return=representation",
      ...(opts.headers||{})
    };
    // Ancien format : on ajoute Authorization. Nouveau format : apikey seul.
    if(!isNewKey) headers["Authorization"] = "Bearer " + SUPABASE_KEY;
    const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, { ...opts, headers });
    if(!res.ok){ throw new Error("Supabase " + res.status + " " + await res.text()); }
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }

  /* ---------- Stockage local (repli) ---------- */
  const LS_PLAYERS = "ccb_players";
  const LS_SCORES  = "ccb_scores";
  function lsGet(k){ try { return JSON.parse(localStorage.getItem(k)) || []; } catch(e){ return []; } }
  function lsSet(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

  /* ===================================================================
     SESSION (persistance de connexion)
     On mémorise UNIQUEMENT le nom du joueur (jamais le mot de passe),
     dans localStorage afin que la session survive à un rafraîchissement
     de page, une navigation entre menus, ou une fermeture/réouverture
     du navigateur. sessionStorage aurait été effacé à la fermeture de
     l'onglet ; on préfère ici une vraie "connexion persistante".
  =================================================================== */
  const LS_SESSION = "ccb_session";
  function saveSession(name){
    try{ localStorage.setItem(LS_SESSION, JSON.stringify({ name, ts: Date.now() })); }
    catch(e){ /* stockage indisponible (mode privé, quota...) : on ignore silencieusement */ }
  }
  function loadSession(){
    try{
      const raw = localStorage.getItem(LS_SESSION);
      if(!raw) return null;
      const o = JSON.parse(raw);
      return (o && typeof o.name === 'string' && o.name) ? o.name : null;
    }catch(e){ return null; }
  }
  function clearSession(){
    try{ localStorage.removeItem(LS_SESSION); }catch(e){}
  }

  /* ===================================================================
     COMPTES
  =================================================================== */
  async function signup(name, password){
    name = (name||"").trim();
    if(!name) throw new Error("Nom requis");
    if(useRemote){
      const existing = await sb("players?name=eq." + encodeURIComponent(name) + "&select=name");
      if(existing && existing.length) throw new Error("Ce nom existe déjà");
      await sb("players", { method:"POST", body: JSON.stringify({ name, password }) });
      return { name };
    } else {
      const players = lsGet(LS_PLAYERS);
      if(players.some(p=>p.name===name)) throw new Error("Ce nom existe déjà");
      players.push({ name, password }); lsSet(LS_PLAYERS, players);
      return { name };
    }
  }

  async function login(name, password){
    name = (name||"").trim();
    if(useRemote){
      const rows = await sb("players?name=eq." + encodeURIComponent(name) + "&select=name,password");
      if(!rows || !rows.length) throw new Error("Compte introuvable");
      if(rows[0].password !== password) throw new Error("Mot de passe incorrect");
      return { name };
    } else {
      const players = lsGet(LS_PLAYERS);
      const pl = players.find(p=>p.name===name);
      if(!pl) throw new Error("Compte introuvable");
      if(pl.password !== password) throw new Error("Mot de passe incorrect");
      return { name };
    }
  }

  /* ===================================================================
     SCORES (speed run) — record = plus petit temps
     Un score = { player, level, cid, time_ms }
  =================================================================== */

  // Enregistre un temps s'il améliore le record (player,level,cid). Renvoie {improved, best}.
  async function submitScore(player, level, cid, timeMs){
    if(useRemote){
      const q = "scores?player=eq."+encodeURIComponent(player)+"&level=eq."+level+"&cid=eq."+cid+"&select=time_ms,id";
      const rows = await sb(q);
      if(rows && rows.length){
        if(timeMs < rows[0].time_ms){
          await sb("scores?id=eq."+rows[0].id, { method:"PATCH", body: JSON.stringify({ time_ms: timeMs }) });
          return { improved:true, best:timeMs };
        }
        return { improved:false, best:rows[0].time_ms };
      } else {
        await sb("scores", { method:"POST", body: JSON.stringify({ player, level, cid, time_ms:timeMs }) });
        return { improved:true, best:timeMs };
      }
    } else {
      const scores = lsGet(LS_SCORES);
      const ex = scores.find(s=>s.player===player && s.level===level && s.cid===cid);
      if(ex){
        if(timeMs < ex.time_ms){ ex.time_ms = timeMs; lsSet(LS_SCORES, scores); return { improved:true, best:timeMs }; }
        return { improved:false, best:ex.time_ms };
      } else {
        scores.push({ player, level, cid, time_ms:timeMs }); lsSet(LS_SCORES, scores);
        return { improved:true, best:timeMs };
      }
    }
  }

  async function allScores(){
    if(useRemote){ return await sb("scores?select=player,level,cid,time_ms") || []; }
    return lsGet(LS_SCORES);
  }

  // Classement d'un (niveau, cid) : trié par temps croissant.
  async function leaderboard(level, cid){
    const all = await allScores();
    return all.filter(s=>s.level===level && (cid==null || s.cid===cid))
              .sort((a,b)=>a.time_ms-b.time_ms);
  }

  // Classement "meilleur toutes catégories" d'un niveau :
  // pour chaque joueur, son meilleur temps quel que soit le perso.
  async function leaderboardBest(level){
    const all = (await allScores()).filter(s=>s.level===level);
    const byPlayer = {};
    for(const s of all){
      if(!byPlayer[s.player] || s.time_ms < byPlayer[s.player].time_ms) byPlayer[s.player] = s;
    }
    return Object.values(byPlayer).sort((a,b)=>a.time_ms-b.time_ms);
  }

  // Classement GLOBAL : nombre de Top1/Top2/Top3 par joueur,
  // comptés sur chaque couple (niveau × personnage).
  async function globalRanking(){
    const all = await allScores();
    // regrouper par (level, cid)
    const groups = {};
    for(const s of all){
      const k = s.level + "|" + s.cid;
      (groups[k] = groups[k] || []).push(s);
    }
    const tally = {};  // player -> {t1,t2,t3}
    for(const k in groups){
      const sorted = groups[k].slice().sort((a,b)=>a.time_ms-b.time_ms);
      ["t1","t2","t3"].forEach((rank,i)=>{
        if(sorted[i]){
          const pl = sorted[i].player;
          tally[pl] = tally[pl] || { player:pl, t1:0,t2:0,t3:0 };
          tally[pl][rank]++;
        }
      });
    }
    // tri : d'abord par or, puis argent, puis bronze
    return Object.values(tally).sort((a,b)=> b.t1-a.t1 || b.t2-a.t2 || b.t3-a.t3);
  }

  /* ===================================================================
     PROGRESSION : monnaie-canards cumulée + meilleur nb de pièces par niveau
     Stockage Supabase : colonnes players.ducks (int) et players.coins_l1 (int 0..3).
     Si ces colonnes n'existent pas encore (migration non faite) ou si la requête
     échoue, on bascule en silence sur le stockage local pour ne jamais bloquer le jeu.
  =================================================================== */
  const LS_PROG = "ccb_progress";   // { [player]: { ducks, coins_l1..3, secret_l1..3 } }
  function progGet(){ try { return JSON.parse(localStorage.getItem(LS_PROG)) || {}; } catch(e){ return {}; } }
  function progSet(o){ localStorage.setItem(LS_PROG, JSON.stringify(o)); }
  function progLocalRead(player){ const o=progGet(); return o[player] || { ducks:0, coins_l1:0, coins_l2:0, coins_l3:0, secret_l1:0, secret_l2:0, secret_l3:0 }; }
  function progLocalWrite(player, data){ const o=progGet(); o[player]={...progLocalRead(player), ...data}; progSet(o); return o[player]; }

  // colonne de pièces selon le niveau
  function coinsCol(level){ return 'coins_l'+level; }
  function secretCol(level){ return 'secret_l'+level; }

  // Lit { ducks, coins_l1..3, secret_l1..3 } pour un joueur.
  async function getProgress(player){
    if(useRemote){
      // 1) tentative AVEC les colonnes secret (schéma à jour)
      try{
        const rows = await sb("players?name=eq."+encodeURIComponent(player)+"&select=ducks,coins_l1,coins_l2,coins_l3,secret_l1,secret_l2,secret_l3");
        if(rows && rows.length){
          const r=rows[0];
          return { ducks:r.ducks||0, coins_l1:r.coins_l1||0, coins_l2:r.coins_l2||0, coins_l3:r.coins_l3||0,
                   secret_l1:r.secret_l1?1:0, secret_l2:r.secret_l2?1:0, secret_l3:r.secret_l3?1:0 };
        }
        return { ducks:0, coins_l1:0, coins_l2:0, coins_l3:0, secret_l1:0, secret_l2:0, secret_l3:0 };
      }catch(e){
        // 2) colonnes secret absentes → on relit sans elles, secrets à 0 (repli partiel)
        try{
          const rows = await sb("players?name=eq."+encodeURIComponent(player)+"&select=ducks,coins_l1,coins_l2,coins_l3");
          if(rows && rows.length){
            const r=rows[0];
            return { ducks:r.ducks||0, coins_l1:r.coins_l1||0, coins_l2:r.coins_l2||0, coins_l3:r.coins_l3||0, secret_l1:0, secret_l2:0, secret_l3:0 };
          }
          return { ducks:0, coins_l1:0, coins_l2:0, coins_l3:0, secret_l1:0, secret_l2:0, secret_l3:0 };
        }catch(e2){ return progLocalRead(player); }   // tout absent → repli local
      }
    }
    return progLocalRead(player);
  }

  // Fin de niveau : ajoute `gained` canards au cumul, retient le meilleur nombre de
  // pièces (max) ET mémorise si le canard SECRET du niveau a été obtenu (jamais reperdu).
  async function addProgress(player, level, coinsThisRun, gained, secretThisRun){
    const col = coinsCol(level);
    const scol = secretCol(level);
    if(useRemote){
      try{
        const rows = await sb("players?name=eq."+encodeURIComponent(player)+"&select=ducks,coins_l1,coins_l2,coins_l3,secret_l1,secret_l2,secret_l3");
        const cur = (rows && rows.length) ? rows[0] : { ducks:0, coins_l1:0, coins_l2:0, coins_l3:0, secret_l1:0, secret_l2:0, secret_l3:0 };
        const newDucks = (cur.ducks||0) + gained;
        const patch = { ducks: newDucks };
        if(level>=1 && level<=3) patch[col] = Math.max(cur[col]||0, coinsThisRun);
        if(level>=1 && level<=3 && secretThisRun) patch[scol] = true;   // une fois obtenu, reste acquis
        await sb("players?name=eq."+encodeURIComponent(player), { method:"PATCH", body: JSON.stringify(patch) });
        const res = { ducks:newDucks, coins_l1:cur.coins_l1||0, coins_l2:cur.coins_l2||0, coins_l3:cur.coins_l3||0,
                      secret_l1:cur.secret_l1?1:0, secret_l2:cur.secret_l2?1:0, secret_l3:cur.secret_l3?1:0 };
        if(patch[col]!=null) res[col] = patch[col];
        if(patch[scol]!=null) res[scol] = 1;
        return res;
      }catch(e){
        // colonnes secret absentes : on réessaie SANS elles pour ne pas perdre les canards normaux
        try{
          const rows = await sb("players?name=eq."+encodeURIComponent(player)+"&select=ducks,coins_l1,coins_l2,coins_l3");
          const cur = (rows && rows.length) ? rows[0] : { ducks:0, coins_l1:0, coins_l2:0, coins_l3:0 };
          const newDucks=(cur.ducks||0)+gained; const patch={ducks:newDucks};
          if(level>=1&&level<=3) patch[col]=Math.max(cur[col]||0, coinsThisRun);
          await sb("players?name=eq."+encodeURIComponent(player), { method:"PATCH", body: JSON.stringify(patch) });
          // le secret est tout de même mémorisé EN LOCAL pour l'affichage
          const loc = progLocalWrite(player, secretThisRun ? { [scol]:1 } : {});
          return { ducks:newDucks, coins_l1:cur.coins_l1||0, coins_l2:cur.coins_l2||0, coins_l3:cur.coins_l3||0,
                   [col]: patch[col], secret_l1:loc.secret_l1||0, secret_l2:loc.secret_l2||0, secret_l3:loc.secret_l3||0 };
        }catch(e2){
          const cur = progLocalRead(player);
          return progLocalWrite(player, { ducks: cur.ducks+gained, [col]: Math.max(cur[col]||0, coinsThisRun), ...(secretThisRun?{[scol]:1}:{}) });
        }
      }
    }
    const cur = progLocalRead(player);
    return progLocalWrite(player, { ducks: cur.ducks+gained, [col]: Math.max(cur[col]||0, coinsThisRun), ...(secretThisRun?{[scol]:1}:{}) });
  }

  // Mes temps sur un niveau, indexés par cid : { cid: time_ms }
  async function myScores(player, level){
    const all = await allScores();
    const out = {};
    for(const s of all){ if(s.player===player && s.level===level){
      if(out[s.cid]==null || s.time_ms<out[s.cid]) out[s.cid]=s.time_ms;
    }}
    return out;
  }

  /* ===================================================================
     DÉBLOCAGES (2e cœur du jeu) — persos achetés + canards dépensés + niveaux finis.
     Stockage Supabase : players.spent (int), players.unlocked (text CSV "4,5"),
     players.levels_done (text CSV "1,2,3"). Repli local silencieux si absent.
     Colonnes SQL à créer :
       alter table players add column if not exists spent int default 0;
       alter table players add column if not exists unlocked text default '';
       alter table players add column if not exists levels_done text default '';
  =================================================================== */
  const LS_UNLOCK = "ccb_unlock";   // { [player]: { spent, unlocked:[..], levels_done:[..] } }
  function unlGet(){ try { return JSON.parse(localStorage.getItem(LS_UNLOCK)) || {}; } catch(e){ return {}; } }
  function unlSet(o){ localStorage.setItem(LS_UNLOCK, JSON.stringify(o)); }
  function unlLocalRead(player){ const o=unlGet(); return o[player] || { spent:0, unlocked:[], levels_done:[] }; }
  function unlLocalWrite(player, data){ const o=unlGet(); o[player]={...unlLocalRead(player), ...data}; unlSet(o); return o[player]; }
  function csvToArr(s){ return (s||'').split(',').map(x=>parseInt(x,10)).filter(x=>!isNaN(x)); }
  function arrToCsv(a){ return (a||[]).join(','); }

  // Lit { spent, unlocked:[cid...], levels_done:[lvl...] }
  async function getUnlocks(player){
    if(useRemote){
      try{
        const rows = await sb("players?name=eq."+encodeURIComponent(player)+"&select=spent,unlocked,levels_done");
        if(rows && rows.length){
          const r=rows[0];
          return { spent:r.spent||0, unlocked:csvToArr(r.unlocked), levels_done:csvToArr(r.levels_done) };
        }
        return { spent:0, unlocked:[], levels_done:[] };
      }catch(e){ return unlLocalRead(player); }   // colonnes absentes → repli local
    }
    return unlLocalRead(player);
  }

  // Marque un niveau comme terminé (idempotent). Renvoie la liste des niveaux finis.
  async function markLevelDone(player, level){
    if(useRemote){
      try{
        const rows = await sb("players?name=eq."+encodeURIComponent(player)+"&select=levels_done");
        const cur = (rows && rows.length) ? csvToArr(rows[0].levels_done) : [];
        if(!cur.includes(level)){
          cur.push(level);
          await sb("players?name=eq."+encodeURIComponent(player), { method:"PATCH", body: JSON.stringify({ levels_done: arrToCsv(cur) }) });
        }
        return cur;
      }catch(e){
        const cur = unlLocalRead(player); if(!cur.levels_done.includes(level)){ cur.levels_done.push(level); unlLocalWrite(player,{levels_done:cur.levels_done}); }
        return cur.levels_done;
      }
    }
    const cur = unlLocalRead(player); if(!cur.levels_done.includes(level)){ cur.levels_done.push(level); unlLocalWrite(player,{levels_done:cur.levels_done}); }
    return cur.levels_done;
  }

  // Achète un perso : déduit `cost` canards (incrémente spent) et ajoute cid à unlocked.
  // Vérifie le solde (ducks - spent) >= cost. Renvoie { ok, spent, unlocked, balance } ou { ok:false }.
  async function buyCharacter(player, cid, cost){
    if(useRemote){
      try{
        const rows = await sb("players?name=eq."+encodeURIComponent(player)+"&select=ducks,spent,unlocked");
        const r = (rows && rows.length) ? rows[0] : { ducks:0, spent:0, unlocked:'' };
        const unlocked = csvToArr(r.unlocked);
        const balance = (r.ducks||0) - (r.spent||0);
        if(unlocked.includes(cid)) return { ok:true, spent:r.spent||0, unlocked, balance };  // déjà acheté
        if(balance < cost) return { ok:false, reason:'insufficient', balance };
        const newSpent = (r.spent||0) + cost;
        unlocked.push(cid);
        await sb("players?name=eq."+encodeURIComponent(player), { method:"PATCH", body: JSON.stringify({ spent:newSpent, unlocked:arrToCsv(unlocked) }) });
        return { ok:true, spent:newSpent, unlocked, balance: balance-cost };
      }catch(e){
        return buyLocal(player, cid, cost);
      }
    }
    return buyLocal(player, cid, cost);
  }
  async function buyLocal(player, cid, cost){
    const prog = await getProgress(player);
    const cur = unlLocalRead(player);
    const balance = (prog.ducks||0) - (cur.spent||0);
    if(cur.unlocked.includes(cid)) return { ok:true, spent:cur.spent, unlocked:cur.unlocked, balance };
    if(balance < cost) return { ok:false, reason:'insufficient', balance };
    cur.unlocked.push(cid);
    const w = unlLocalWrite(player, { spent:cur.spent+cost, unlocked:cur.unlocked });
    return { ok:true, spent:w.spent, unlocked:w.unlocked, balance: balance-cost };
  }

  return { useRemote, signup, login, submitScore, leaderboard, leaderboardBest, globalRanking, getProgress, addProgress, myScores, getUnlocks, markLevelDone, buyCharacter, saveSession, loadSession, clearSession };
})();

window.Backend = Backend;
