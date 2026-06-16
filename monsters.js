/* =====================================================================
   monsters.js — Sprites des monstres (extrait de sandbox_monsters_V1)
   Source de vérité des sprites ennemis. L'IA des monstres vit dans
   engine.js ; ici uniquement le dessin.
===================================================================== */
function drawWalkerSprite(x,y,frame,dir,w,h) {
  ctx.save();
  ctx.translate(x+w/2, y+h);
  ctx.scale((w/24)*dir, h/24);
  ctx.fillStyle='#2a7a10'; ctx.fillRect(-10,-16,20,14);
  ctx.fillStyle='#3aaa18'; ctx.fillRect(-8,-18,16,4);
  ctx.fillStyle='#1a5a08';
  ctx.fillRect(-6,-15,5,5); ctx.fillRect(1,-15,5,5); ctx.fillRect(-3,-10,6,4);
  ctx.fillStyle='#0a3004';
  ctx.fillRect(-10,-16,20,1); ctx.fillRect(-10,-16,1,14); ctx.fillRect(9,-16,1,14);
  ctx.fillStyle='#5ac828'; ctx.fillRect(6,-14,8,8);
  ctx.fillStyle='#78e840'; ctx.fillRect(7,-16,6,3);
  ctx.fillStyle='#1a1a1a'; ctx.fillRect(11,-13,2,2);
  ctx.fillStyle='#ffffff'; ctx.fillRect(12,-13,1,1);
  const ly=frame===0?0:-2;
  ctx.fillStyle='#5ac828';
  ctx.fillRect(-10,-4,5,6+ly); ctx.fillRect(5,-4,5,6-ly);
  ctx.fillStyle='#e8d870'; ctx.fillRect(-8,-2,16,4);
  ctx.fillStyle='#c8b850'; ctx.fillRect(-6,-2,12,2);
  ctx.restore();
}

function drawFlyerSprite(x,y,frame,dir,w,h) {
  ctx.save();
  ctx.translate(x+w/2, y+h/2);
  ctx.scale((w/28)*dir, h/20);
  const wy=frame===0?0:4;
  ctx.fillStyle='#6020a0';
  ctx.fillRect(-14,-4+wy,10,Math.max(1,8-wy)); ctx.fillRect(-18,-2+wy,6,4);
  ctx.fillStyle='#8030c0'; ctx.fillRect(-13,-2+wy,8,Math.max(1,4-wy/2));
  ctx.fillStyle='#6020a0';
  ctx.fillRect(4,-4+wy,10,Math.max(1,8-wy)); ctx.fillRect(12,-2+wy,6,4);
  ctx.fillStyle='#8030c0'; ctx.fillRect(5,-2+wy,8,Math.max(1,4-wy/2));
  ctx.fillStyle='#501888'; ctx.fillRect(-6,-8,12,14);
  ctx.fillStyle='#7020b0'; ctx.fillRect(-4,-8,8,3);
  ctx.fillStyle='#d0a0e0'; ctx.fillRect(-4,-2,8,6);
  ctx.fillStyle='#b880c8'; ctx.fillRect(-3,-1,6,4);
  ctx.fillStyle='#501888';
  ctx.fillRect(-4,-12,4,5); ctx.fillRect(0,-12,4,5);
  ctx.fillStyle='#ff80a0'; ctx.fillRect(-3,-11,2,3); ctx.fillRect(1,-11,2,3);
  ctx.fillStyle='#ff2020'; ctx.fillRect(-4,-5,3,3); ctx.fillRect(1,-5,3,3);
  ctx.fillStyle='#ff8080'; ctx.fillRect(-4,-5,1,1); ctx.fillRect(1,-5,1,1);
  ctx.fillStyle='#ffffff'; ctx.fillRect(-2,5,2,4); ctx.fillRect(0,5,2,4);
  ctx.restore();
}

function drawCasterSprite(x,y,frame,dir,w,h) {
  ctx.save();
  ctx.translate(x+w/2, y+h);
  ctx.scale((w/32)*dir, h/48);
  ctx.fillStyle='#c03010';
  ctx.fillRect(8,-10,12,8); ctx.fillRect(16,-6,8,6); ctx.fillRect(22,-3,6,5);
  ctx.fillStyle='#e04020'; ctx.fillRect(8,-10,12,3);
  ctx.fillStyle='#ff6040'; ctx.fillRect(24,0,5,5);
  ctx.fillStyle='#a02808'; ctx.fillRect(-6,-8,8,10); ctx.fillRect(0,-8,8,10);
  ctx.fillStyle='#c03010'; ctx.fillRect(-8,-2,5,6); ctx.fillRect(3,-2,5,6);
  ctx.fillStyle='#f0c070';
  ctx.fillRect(-10,3,3,4); ctx.fillRect(-7,4,3,3); ctx.fillRect(5,3,3,4); ctx.fillRect(8,4,3,3);
  ctx.fillStyle='#c03010'; ctx.fillRect(-12,-32,24,24);
  ctx.fillStyle='#e04020'; ctx.fillRect(-10,-32,20,6);
  ctx.fillStyle='#f09060'; ctx.fillRect(-8,-28,16,18);
  ctx.fillStyle='#e07848';
  for(let sy=0;sy<4;sy++) for(let sx=0;sx<3;sx++) ctx.fillRect(-6+sx*5,-26+sy*5,4,4);
  ctx.fillStyle='#801808'; ctx.fillRect(-20,-38,10,18); ctx.fillRect(-24,-32,6,12);
  ctx.fillStyle='#a02010'; ctx.fillRect(-18,-36,8,14);
  ctx.fillStyle='#601010';
  ctx.fillRect(-20,-38,2,18); ctx.fillRect(-16,-36,2,14); ctx.fillRect(-12,-34,2,10);
  ctx.fillStyle='#c03010'; ctx.fillRect(-8,-44,10,14);
  ctx.fillStyle='#e04020'; ctx.fillRect(-6,-44,6,4);
  ctx.fillStyle='#ff6020';
  ctx.fillRect(-10,-46,4,4); ctx.fillRect(-6,-48,4,5); ctx.fillRect(-2,-46,4,4);
  ctx.fillStyle='#d03818'; ctx.fillRect(-12,-58,22,16);
  ctx.fillStyle='#e04828'; ctx.fillRect(-10,-58,18,5);
  ctx.fillStyle='#b02808'; ctx.fillRect(-12,-46,22,6);
  ctx.fillStyle='#f0f0e0';
  for(let ti=0;ti<4;ti++) ctx.fillRect(-10+ti*5,-44,3,5);
  if(frame===1){ctx.fillStyle='#ff4060';ctx.fillRect(6,-44,8,4);ctx.fillRect(10,-42,4,4);}
  ctx.fillStyle='#ff8800'; ctx.fillRect(-6,-54,8,8);
  ctx.fillStyle='#cc5500'; ctx.fillRect(-4,-52,4,4);
  ctx.fillStyle='#1a0800'; ctx.fillRect(-3,-52,2,4);
  ctx.fillStyle='#ffffff'; ctx.fillRect(-4,-54,2,2);
  ctx.fillStyle='#f0d060'; ctx.fillRect(-4,-62,4,6); ctx.fillRect(-2,-66,2,4);
  ctx.restore();
}

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
