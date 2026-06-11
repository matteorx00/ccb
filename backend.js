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

  return { useRemote, signup, login, submitScore, leaderboard, leaderboardBest, globalRanking };
})();

window.Backend = Backend;
