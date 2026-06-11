/* =====================================================================
   characters.js — Définition des 6 personnages (extrait de sandbox_V3)
   Source de vérité des persos jouables. Chaque perso : physique + pouvoirs
   + fonction de sprite. Le sandbox HTML reste l'outil d'édition/preview.
===================================================================== */
const CHARS = {
  1:{name:'Baptiste', color:'#4090e0',
     desc:"Baptiste est un personnage tout \u00e0 fait normal. On raconte qu'il se serait perdu.",
     descPower:"Baptiste n'a pas de pouvoir, son seul moyen d'\u00e9liminer les ennemis est de leur sauter dessus.",
     phys:{gravity:0.155,jumpForce:-5.30,jumpCutoff:-3.04,fallMax:5.50,runMax:2.40,accel:0.18,decel:0.14,airAccel:0.10,airDecel:0.03},
     hasDash:false,hasDoubleJump:false,hasFireball:false,hasArmor:false,hasGiant:false,drawH:32,drawHcr:20},
  2:{name:'Oscar', color:'#cc44ff',
     desc:"Oscar est un personnage qui adore courir, il va vraiment tr\u00e8s vite. Il est tr\u00e8s pos\u00e9 en temps normal mais il peut parfois avoir des pulsions violentes qui le rendent dangereux.",
     descPower:"Oscar est capable de se propulser en avant gr\u00e2ce \u00e0 ses jambes muscl\u00e9es. Cette propulsion le rend plus rapide et peut m\u00eame \u00e9liminer les ennemis qui sont sur son passage.",
     phys:{gravity:0.170,jumpForce:-5.30,jumpCutoff:-2.92,fallMax:5.80,runMax:2.40,accel:0.22,decel:0.16,airAccel:0.14,airDecel:0.04},
     hasDash:true,dashSpeed:9.0,dashDuration:14,dashCooldown:40,
     hasDoubleJump:false,hasFireball:false,hasArmor:false,hasGiant:false,drawH:32,drawHcr:20},
  3:{name:'Timoth\u00e9e', color:'#00ddaa',
     desc:"Timoth\u00e9 est tr\u00e8s petit mais il ne faut pas se fier aux apparences, il est bien plus agile que tous les autres personnages.",
     descPower:"Timoth\u00e9 peut sauter tr\u00e8s haut et se faufiler dans des endroits normalement inaccessibles.",
     phys:{gravity:0.140,jumpForce:-5.40,jumpCutoff:-3.20,fallMax:5.00,runMax:1.90,accel:0.20,decel:0.15,airAccel:0.13,airDecel:0.04},
     hasDash:false,hasDoubleJump:true,hasFireball:false,hasArmor:false,hasGiant:false,drawH:24,drawHcr:14},
  4:{name:'Matteo', color:'#44cc44',
     desc:"Matteo est un personnage tr\u00e8s normal, comme Baptiste il semble s'\u00eatre perdu. Il a cependant la particularit\u00e9 d'\u00eatre press\u00e9 de trouver des toilettes. Matteo a une diarrh\u00e9e permanente.",
     descPower:"Matteo utilise sa maladie comme un atout, il utilise ce qu'il peut pour d\u00e9truire ses ennemis.",
     phys:{gravity:0.155,jumpForce:-5.30,jumpCutoff:-3.04,fallMax:5.50,runMax:2.05,accel:0.18,decel:0.14,airAccel:0.10,airDecel:0.03},
     hasDash:false,hasDoubleJump:false,hasFireball:true,fireballCooldown:120,
     ballVx:3.6,ballVy:2.3,hasArmor:false,hasGiant:false,drawH:32,drawHcr:20},
  5:{name:'Victor', color:'#ff4444',
     desc:"Victor est un \u00eatre grand et puissant. On dit que les monstres ont peur de lui.",
     descPower:"Victor par sa grande taille saute tr\u00e8s haut mais son manque d'agilit\u00e9 l'emp\u00eache de s'accroupir. Il peut parfois d\u00e9clencher un \u00e9tat sup\u00e9rieur dans lequel il est invincible pendant plusieurs secondes.",
     phys:{gravity:0.155,jumpForce:-5.90,jumpCutoff:-3.95,fallMax:5.50,runMax:1.95,accel:0.27,decel:0.10,airAccel:0.10,airDecel:0.021},
     hasDash:false,hasDoubleJump:false,hasFireball:false,hasArmor:false,
     hasGiant:true,giantCharges:2,giantDuration:300,canCrouch:false,drawH:48,drawHcr:48},
  6:{name:'Corentin', color:'#ff8800',
     desc:"Corentin est le personnage le plus puissant que l'on puisse rencontrer, il est particuli\u00e8rement r\u00e9sistant gr\u00e2ce \u00e0 ses muscles saillants.",
     descPower:"Corentin est tr\u00e8s r\u00e9sistant, il peut survivre deux fois apr\u00e8s avoir \u00e9t\u00e9 touch\u00e9 par un ennemi. Ses pieds endurcis lui permettent de marcher sur les pics sans aucune douleur.",
     phys:{gravity:0.230,jumpForce:-6.20,jumpCutoff:-3.20,fallMax:6.50,runMax:2.65,accel:0.28,decel:0.15,airAccel:0.12,airDecel:0.03},
     hasDash:false,hasDoubleJump:false,hasFireball:false,
     hasArmor:true,armorMax:2,spikeImmune:true,hasGiant:false,drawH:24,drawHcr:15},
};

/* Dispatcher : dessine le sprite du perso `cid` (le contexte est déjà
   translaté au bas-centre par le moteur, et retourné selon facing). */
function drawCharacterSprite(cid, cr, air, la){
  if(cid===1)      drawBaptiste(cr,air,la);
  else if(cid===2) drawOscar(cr,air,la);
  else if(cid===3) drawTimothee(cr,air,la);
  else if(cid===4) drawMatteo(cr,air,la);
  else if(cid===5) drawVictor(cr,air,la);
  else if(cid===6) drawCorentin(cr,air,la);
}


/* ── Primitives et sprites (verbatim sandbox_V3) ── */
function pr(x,y,w,h,fill,stroke){
  x=Math.round(x); y=Math.round(y); w=Math.round(w); h=Math.round(h);
  ctx.fillStyle=fill; ctx.fillRect(x,y,w,h);
  if(stroke){ ctx.fillStyle=stroke; ctx.fillRect(x,y,w,1); ctx.fillRect(x,y,1,h); ctx.fillRect(x+w-1,y,1,h); ctx.fillRect(x,y+h-1,w,1); }
}

function drawBaptiste(cr,air,la){
  const sk='#f2c898',skD='#d4a272',skDD='#b07848',skL='#fae0b8';
  const ha='#5c3010',haD='#3a1e08',haL='#7a4820';
  const sh='#202020',shD='#0e0e0e',shL='#303030',shLL='#404040';
  const pa='#181818',paD='#0a0a0a',paL='#262626';
  const bo='#e8ddd0',boD='#c8bca8',boDD='#a89880',boL='#f4f0ea';
  const so='#f0f0f0',soD='#d8d8d8',pkt='#2a2a2a',eye='#1a1008';
  const Z=2,BY=39,CX=10;
  ctx.save(); ctx.scale(0.7,0.7);
  const dot = (xn,yn,f) => {pr((xn-CX)*Z,(yn-BY)*Z,Z,Z,f,null);}
  if(cr){
    const BYc=25;
    const dc = (xn,yn,f) => {pr((xn-CX)*Z,(yn-BYc)*Z,Z,Z,f,null);}
    for(let x=1;x<=7;x++) dc(x,24,x===1||x===7?boD:x===2?boL:bo);
    for(let x=1;x<=7;x++) dc(x,25,boDD);
    dc(3,23,soD);dc(5,23,soD);
    for(let x=12;x<=17;x++) dc(x,24,x===12||x===17?boD:x===13?boL:bo);
    for(let x=12;x<=17;x++) dc(x,25,boDD);
    dc(13,23,soD);dc(15,23,soD);
    for(let x=2;x<7;x++){dc(x,22,so);dc(x,23,soD);}
    for(let x=12;x<17;x++){dc(x,22,so);dc(x,23,soD);}
    const jD=[[1,2,3,4,5,6,7],[1,2,3,4,5,6,7],[1,2,3,4,5,6],[2,3,4,5,6],[2,3,4,5]];
    for(let i=0;i<5;i++){jD[i].forEach(x=>{const lc=x===1?paD:x===jD[i][jD[i].length-1]?paD:i<2?paL:pa;dc(x,21-i,lc);dc(19-x,21-i,lc);});}
    for(let i=0;i<9;i++){dc(1,14-i,shD);for(let x=2;x<18;x++)dc(x,14-i,i===8?shLL:i<3?shL:sh);dc(18,14-i,shD);}
    for(let i=0;i<7;i++){dc(-1,9-i,i<3?shL:sh);dc(-2,9-i,i<2?shLL:shL);dc(20,9-i,i<3?shL:sh);dc(21,9-i,i<2?shLL:shL);}
    dc(-1,14,sk);dc(20,14,sk);
    baptisteHead(dc,0);
  } else {
    const lLn=Math.round(la[0][1]/Z),lRn=Math.round(la[1][1]/Z);
    dot(2,38+lLn,boL);for(let x=3;x<=6;x++)dot(x,38+lLn,bo);dot(7,38+lLn,boD);dot(1,39+lLn,boD);for(let x=2;x<=7;x++)dot(x,39+lLn,bo);dot(3,38+lLn,soD);dot(5,38+lLn,soD);for(let x=1;x<=7;x++)dot(x,40+lLn,boDD);
    dot(12,38+lRn,boL);for(let x=13;x<=16;x++)dot(x,38+lRn,bo);dot(17,38+lRn,boD);dot(11,39+lRn,boD);for(let x=12;x<=17;x++)dot(x,39+lRn,bo);dot(13,38+lRn,soD);dot(15,38+lRn,soD);for(let x=11;x<=17;x++)dot(x,40+lRn,boDD);
    for(let x=2;x<=6;x++){dot(x,36+lLn,so);dot(x,37+lLn,soD);}
    for(let x=12;x<=16;x++){dot(x,36+lRn,so);dot(x,37+lRn,soD);}
    for(let i=0;i<10;i++){const zone=i<3?'top':i<6?'mid':'low';const lc=zone==='top'?paL:zone==='mid'?pa:paD;const yl=27+i+lLn,yr=27+i+lRn;dot(1,yl,paD);dot(2,yl,zone==='top'?paL:pa);for(let x=3;x<=6;x++)dot(x,yl,lc);dot(7,yl,paD);dot(11,yr,paD);dot(12,yr,zone==='top'?paL:pa);for(let x=13;x<=16;x++)dot(x,yr,lc);dot(17,yr,paD);}
    for(let x=3;x<=5;x++)dot(x,31+lLn,paL);for(let x=13;x<=15;x++)dot(x,31+lRn,paL);
    for(let x=7;x<=11;x++)dot(x,27,paD);for(let x=8;x<=10;x++)dot(x,28,paD);
    for(let x=1;x<19;x++)dot(x,26,shD);for(let x=1;x<19;x++)dot(x,25,paD);
    dot(8,26,'#8a7030');dot(9,26,'#c0a040');dot(10,26,'#c0a040');dot(11,26,'#8a7030');
    for(let i=0;i<10;i++){const yy=15+i;dot(1,yy,shD);dot(2,yy,i<2?shLL:i<4?shL:sh);for(let x=3;x<17;x++)dot(x,yy,i<2?shL:i>8?shD:sh);dot(17,yy,i<2?shL:shD);dot(18,yy,shD);}
    dot(5,15,shD);dot(14,15,shD);
    for(let i=0;i<3;i++){dot(3,20+i,pkt);dot(4,20+i,pkt);dot(5,20+i,pkt);dot(14,20+i,pkt);dot(15,20+i,pkt);dot(16,20+i,pkt);}
    dot(3,23,skDD);dot(4,23,skD);dot(5,23,skDD);dot(14,23,skDD);dot(15,23,skD);dot(16,23,skDD);
    for(let i=0;i<10;i++){dot(-1,15+i,i<2?shL:sh);dot(-2,15+i,i<2?shLL:shL);dot(19,15+i,i<2?shL:sh);dot(20,15+i,i<2?shLL:shL);}
    dot(-1,24,sk);dot(0,24,sk);dot(19,24,sk);dot(20,24,sk);
    for(let x=8;x<=11;x++){dot(x,14,sk);dot(x,13,skD);}
    dot(7,14,shD);dot(12,14,shD);for(let x=7;x<=12;x++)dot(x,15,shL);
    baptisteHead(dot,0);
  }
  ctx.restore();
}

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

function drawOscar(cr,air,la){
  const sk='#f5dfc0',skD='#d4a878',skDD='#b08048',skL='#fdf0e0';
  const ha='#e8cc50',haD='#c0a030',haL='#f5e080';
  const sh='#e06010',shD='#a03808',shL='#f08030',shLL='#ff9840';
  const pa='#3868b0',paD='#1a3878',paL='#5888d0',paLL='#78a8e8';
  const bo='#e8ddd0',boD='#c8bca8',boDD='#a09878',boL='#f5f0ea';
  const so='#1a1a1a',soL='#2a2a2a',jeans='#2a5090';
  const Z=2,BY=39,CX=10;
  ctx.save(); ctx.scale(0.7,0.7);
  const dot = (xn,yn,f) => {pr((xn-CX)*Z,(yn-BY)*Z,Z,Z,f,null);}
  if(cr){
    const BYc=25;
    const dc = (xn,yn,f) => {pr((xn-CX)*Z,(yn-BYc)*Z,Z,Z,f,null);}
    for(let x=1;x<=7;x++)dc(x,24,x===1||x===7?boD:x===2?boL:bo);for(let x=1;x<=7;x++)dc(x,25,boDD);dc(3,23,soL);dc(5,23,soL);
    for(let x=12;x<=17;x++)dc(x,24,x===12||x===17?boD:x===13?boL:bo);for(let x=12;x<=17;x++)dc(x,25,boDD);dc(13,23,soL);dc(15,23,soL);
    for(let x=2;x<7;x++){dc(x,22,soL);dc(x,23,so);}for(let x=12;x<17;x++){dc(x,22,soL);dc(x,23,so);}
    const rows=[[0,1,2,3,4,5,6,7,8],[1,2,3,4,5,6,7,8],[1,2,3,4,5,6,7],[2,3,4,5,6,7],[2,3,4,5,6]];
    for(let i=0;i<rows.length;i++){const lc=i<2?paLL:i<4?paL:pa;rows[i].forEach(x=>{const col=x===0?paD:x===rows[i][rows[i].length-1]?paD:lc;dc(x,21-i,col);dc(19-x,21-i,col);});}
    for(let i=0;i<9;i++){dc(1,14-i,shD);for(let x=2;x<18;x++)dc(x,14-i,i===8?shLL:i<3?shL:sh);dc(18,14-i,shD);}
    for(let i=0;i<7;i++){dc(-1,9-i,i<3?shL:sh);dc(-2,9-i,i<2?shLL:shL);dc(20,9-i,i<3?shL:sh);dc(21,9-i,i<2?shLL:shL);}
    dc(-1,14,sk);dc(20,14,sk);
    oscarHead(dc,0);
  } else {
    const lLn=Math.round(la[0][1]/Z),lRn=Math.round(la[1][1]/Z);
    dot(2,38+lLn,boL);for(let x=3;x<=6;x++)dot(x,38+lLn,bo);dot(7,38+lLn,boD);dot(1,39+lLn,boD);for(let x=2;x<=7;x++)dot(x,39+lLn,bo);dot(3,38+lLn,soL);dot(5,38+lLn,soL);for(let x=1;x<=7;x++)dot(x,40+lLn,boDD);
    dot(12,38+lRn,boL);for(let x=13;x<=16;x++)dot(x,38+lRn,bo);dot(17,38+lRn,boD);dot(11,39+lRn,boD);for(let x=12;x<=17;x++)dot(x,39+lRn,bo);dot(13,38+lRn,soL);dot(15,38+lRn,soL);for(let x=11;x<=17;x++)dot(x,40+lRn,boDD);
    for(let x=2;x<=6;x++){dot(x,36+lLn,soL);dot(x,37+lLn,so);}for(let x=12;x<=16;x++){dot(x,36+lRn,soL);dot(x,37+lRn,so);}
    for(let i=0;i<10;i++){const zone=i<3?'top':i<6?'mid':'low';const mc=zone==='top'?paLL:zone==='mid'?paL:pa;const yl=27+i+lLn,yr=27+i+lRn;dot(1,yl,paD);dot(2,yl,zone==='top'?paL:pa);for(let x=3;x<=7;x++)dot(x,yl,mc);dot(8,yl,jeans);dot(9,yl,paD);dot(10,yr,paD);dot(11,yr,jeans);dot(12,yr,zone==='top'?paL:pa);for(let x=13;x<=17;x++)dot(x,yr,mc);dot(18,yr,paD);}
    for(let x=3;x<=6;x++)dot(x,31+lLn,paLL);for(let x=12;x<=16;x++)dot(x,31+lRn,paLL);
    for(let x=7;x<=11;x++)dot(x,27,paD);for(let x=8;x<=10;x++)dot(x,28,paD);
    for(let x=1;x<19;x++)dot(x,26,'#0e2040');for(let x=1;x<19;x++)dot(x,25,paD);dot(9,25,'#c0c0c0');dot(10,25,'#c0c0c0');
    for(let i=0;i<10;i++){const yy=15+i;dot(1,yy,shD);dot(2,yy,i<2?shLL:shL);for(let x=3;x<17;x++)dot(x,yy,i===0?shLL:i<3?shL:i>8?shD:sh);dot(17,yy,i<2?shL:shD);dot(18,yy,shD);}
    dot(4,15,shD);dot(15,15,shD);
    for(let i=0;i<10;i++){dot(-1,15+i,i<2?shL:i>8?skD:sh);dot(-2,15+i,i<2?shLL:i>8?skD:shL);dot(19,15+i,i<2?shL:i>8?skD:sh);dot(20,15+i,i<2?shLL:i>8?skD:shL);}
    if(air){dot(-1,13,sh);dot(-1,14,sh);dot(-2,13,shL);dot(-2,14,shL);dot(19,13,sh);dot(19,14,sh);dot(20,13,shL);dot(20,14,shL);}
    dot(-1,24,sk);dot(0,24,sk);dot(19,24,sk);dot(20,24,sk);
    for(let x=8;x<=11;x++){dot(x,14,sk);dot(x,13,skD);}dot(6,15,shD);dot(7,15,shL);for(let x=8;x<12;x++)dot(x,15,shL);dot(12,15,shL);dot(13,15,shD);dot(7,14,shD);dot(12,14,shD);
    oscarHead(dot,0);
    if(dash.cooldown===0&&!dash.active){dot(-2,BY-41,'#ffcc00');dot(-1,BY-41,'#ffcc00');dot(19,BY-41,'#ffcc00');dot(20,BY-41,'#ffcc00');}
  }
  ctx.restore();
}

function oscarHead(d,H){
  const sk='#f5dfc0',skD='#d4a878',skDD='#b08048',skL='#fdf0e0';
  const ha='#e8cc50',haD='#c0a030',haL='#f5e080',eye='#1a1040';
  [3,4,5,6,7,8,9,10,11,12,13,14,15,16].forEach(x=>d(x,H,x<6||x>13?haD:x<8||x>11?ha:haL));
  [2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17].forEach(x=>d(x,H+1,x<4||x>15?haD:x<6||x>13?ha:haL));
  [2,3,4,5,6,15,16,17].forEach(x=>d(x,H+2,x<4||x>15?haD:ha));
  d(8,H+1,haL);d(9,H+1,haL);d(9,H+2,haL);d(10,H+2,ha);d(10,H+3,haD);
  for(let x=3;x<17;x++)d(x,H+3,x<5||x>14?skD:skL);
  for(let i=4;i<13;i++){d(2,H+i,skD);d(3,H+i,skD);for(let x=4;x<16;x++)d(x,H+i,i<6?skL:sk);d(16,H+i,skD);d(17,H+i,skD);}
  d(17,H+5,sk);d(18,H+6,skD);d(18,H+7,skDD);d(17,H+8,sk);d(2,H+5,sk);d(1,H+6,skD);d(1,H+7,skDD);d(2,H+8,sk);
  d(4,H+4,haD);d(5,H+4,ha);d(6,H+4,ha);d(12,H+4,ha);d(13,H+4,ha);d(14,H+4,haD);
  [4,5,6].forEach(x=>{d(x,H+6,'#fff');d(x,H+8,skD);});d(4,H+7,'#fff');d(5,H+7,'#2060a8');d(6,H+7,'#fff');
  [12,13,14].forEach(x=>{d(x,H+6,'#fff');d(x,H+8,skD);});d(12,H+7,'#fff');d(13,H+7,'#2060a8');d(14,H+7,'#fff');
  d(9,H+8,skD);d(10,H+9,skD);d(10,H+10,skDD);
  d(7,H+11,skD);d(8,H+11,skDD);d(9,H+11,skDD);d(10,H+11,skDD);d(11,H+11,skDD);d(12,H+11,skD);d(8,H+12,skD);d(11,H+12,skD);
  d(4,H+12,skD);for(let x=5;x<15;x++)d(x,H+12,x===9||x===10?skL:sk);d(15,H+12,skD);
  d(5,H+13,skD);d(6,H+13,skD);for(let x=7;x<13;x++)d(x,H+13,skD);d(13,H+13,skD);d(14,H+13,skD);
}

function drawTimothee(cr,air,la){
  const sk='#f8e040',skD='#c8b010',skDD='#907808',skL='#fdf080';
  const ha='#1a1a1a',haD='#0a0a0a',haL='#2e2e2e';
  const sh='#1c1c1c',shD='#0a0a0a',shL='#303030',shLL='#404040';
  const pa='#161616',paD='#080808',paL='#242424';
  const bo='#e8ddd0',boD='#c8bca8',boDD='#a09878',boL='#f5f0ea';
  const so='#f0c820',soD='#c0a010';
  const vb='#e8e8e8',vbD='#c0c0c0',eye='#0a0808';
  const Z=2,BY=39,CX=7;
  ctx.save(); ctx.scale(0.55,0.55);
  const dot = (xn,yn,f) => {pr((xn-CX)*Z,(yn-BY)*Z,Z,Z,f,null);}
  if(cr){
    const BYc=13;
    const dc = (xn,yn,f) => {pr((xn-CX)*Z,(yn-BYc)*Z,Z,Z,f,null);}
    for(let x=0;x<5;x++){dc(x,11,so);dc(x,12,soD);}for(let x=9;x<14;x++){dc(x,11,so);dc(x,12,soD);}
    const shoe2 = (bx,vy) => {dc(bx,vy-1,boL);for(let x=bx+1;x<bx+5;x++)dc(x,vy-1,bo);dc(bx+5,vy-1,boD);for(let x=bx-1;x<=bx+5;x++)dc(x,vy,boDD);}
    shoe2(0,BYc);shoe2(9,BYc);
    const jr=[[0,1,2,3,4,5,6],[1,2,3,4,5,6],[2,3,4,5,6],[2,3,4,5]];
    for(let i=0;i<jr.length;i++){const lc=i<2?paL:pa;jr[i].forEach(x=>{const col=x===0?paD:x===jr[i][jr[i].length-1]?paD:lc;dc(x,10-i,col);dc(14-x,10-i,col);});}
    for(let i=0;i<5;i++){dc(0,9-i,shD);for(let x=1;x<14;x++)dc(x,9-i,i===4?shLL:i<2?shL:sh);dc(14,9-i,shD);}
    dc(3,7,vb);dc(4,7,vb);dc(5,7,vb);dc(9,7,vb);dc(10,7,vb);dc(11,7,vb);dc(6,7,vb);dc(7,6,vb);dc(8,7,vb);
    dc(-1,6,sh);dc(-1,7,sh);dc(-1,8,skD);dc(15,6,sh);dc(15,7,sh);dc(15,8,skD);
    timHead(dc,-8);
  } else {
    const lLn=Math.round(la[0][1]/Z),lRn=Math.round(la[1][1]/Z);
    const shoe = (bx,lOff) => {dot(bx,36+lOff,boL);for(let x=bx+1;x<bx+5;x++)dot(x,36+lOff,bo);dot(bx+5,36+lOff,boD);dot(bx+1,36+lOff,soD);dot(bx+3,36+lOff,soD);dot(bx-1,37+lOff,boD);for(let x=bx;x<bx+5;x++)dot(x,37+lOff,bo);dot(bx+5,37+lOff,boD);for(let x=bx-1;x<=bx+5;x++)dot(x,38+lOff,boDD);}
    shoe(1,lLn);shoe(9,lRn);
    for(let x=1;x<=5;x++){dot(x,34+lLn,so);dot(x,35+lLn,soD);}for(let x=9;x<=13;x++){dot(x,34+lRn,so);dot(x,35+lRn,soD);}
    for(let i=0;i<9;i++){const zone=i<2?'top':i<5?'mid':'low';const lc=zone==='top'?paL:zone==='mid'?pa:paD;const yl=25+i+lLn,yr=25+i+lRn;dot(0,yl,paD);dot(1,yl,zone==='top'?paL:pa);for(let x=2;x<=5;x++)dot(x,yl,lc);dot(6,yl,paD);dot(7,yl,paD);dot(7,yr,paD);dot(8,yr,paD);dot(9,yr,zone==='top'?paL:pa);for(let x=9;x<=13;x++)dot(x,yr,lc);dot(14,yr,paD);}
    for(let x=2;x<=5;x++)dot(x,29+lLn,paL);for(let x=9;x<=12;x++)dot(x,29+lRn,paL);
    dot(6,25,paD);dot(7,25,paD);dot(8,25,paD);dot(7,26,paD);for(let x=1;x<14;x++)dot(x,24,paD);
    for(let i=0;i<9;i++){const yy=15+i;dot(0,yy,shD);dot(1,yy,i<2?shL:sh);for(let x=2;x<13;x++)dot(x,yy,i===0?shLL:i<2?shL:i>7?shD:sh);dot(13,yy,i<2?shL:shD);dot(14,yy,shD);}
    dot(3,15,shD);dot(11,15,shD);
    dot(2,18,vb);dot(3,18,vb);dot(4,18,vb);dot(1,19,vb);dot(3,19,'#fff');dot(5,19,vb);dot(2,20,vb);dot(3,20,vb);dot(4,20,vb);
    dot(10,18,vb);dot(11,18,vb);dot(12,18,vb);dot(9,19,vb);dot(11,19,'#fff');dot(13,19,vb);dot(10,20,vb);dot(11,20,vb);dot(12,20,vb);
    dot(5,19,vb);dot(6,18,vb);dot(7,17,vb);dot(6,19,vb);dot(7,19,vb);dot(8,19,vb);dot(8,18,vb);dot(9,18,vbD);
    dot(7,16,vb);dot(8,16,vb);dot(6,16,vbD);dot(9,16,vbD);
    dot(-1,15,shD);dot(-1,16,shL);dot(-1,17,sh);dot(-1,18,sh);dot(-1,19,sh);dot(-1,20,skD);dot(-1,21,sk);
    dot(15,15,shD);dot(15,16,shL);dot(15,17,sh);dot(15,18,sh);dot(15,19,sh);dot(15,20,skD);dot(15,21,sk);
    if(air){dot(-1,13,sh);dot(-1,14,sh);dot(15,13,sh);dot(15,14,sh);}
    for(let x=6;x<9;x++){dot(x,13,skD);dot(x,14,sk);}
    dot(5,15,shD);dot(6,15,shL);dot(7,15,shL);dot(8,15,shL);dot(9,15,shD);dot(5,14,shD);dot(9,14,shD);
    timHead(dot,0);
    if(!djump.used){dot(3,BY-41,'#00ddaa');dot(4,BY-41,'#00ddaa');dot(10,BY-41,'#00ddaa');dot(11,BY-41,'#00ddaa');}
  }
  ctx.restore();
}

function timHead(d,H){
  const sk='#f8e040',skD='#c8b010',skDD='#907808',skL='#fdf080';
  const ha='#1a1a1a',haD='#0a0a0a',haL='#2e2e2e',eye='#0a0808';
  [2,3,4,5,6,7,8,9,10,11,12].forEach(x=>d(x,H,x<4||x>10?haD:ha));
  [1,2,3,4,5,6,7,8,9,10,11,12,13].forEach(x=>d(x,H+1,x<3||x>11?haD:x===5||x===9?haL:ha));
  [1,2,3,12,13,14].forEach(x=>d(x,H+2,x<3||x>12?haD:ha));
  for(let x=2;x<13;x++)d(x,H+3,x<4||x>11?skD:skL);
  for(let i=4;i<11;i++){d(1,H+i,skD);d(2,H+i,skD);for(let x=3;x<12;x++)d(x,H+i,i<6?skL:sk);d(12,H+i,skD);d(13,H+i,skD);}
  d(1,H+5,sk);d(0,H+6,skD);d(0,H+7,skDD);d(1,H+7,sk);d(13,H+5,sk);d(14,H+6,skD);d(14,H+7,skDD);d(13,H+7,sk);
  d(3,H+4,ha);d(4,H+4,ha);d(5,H+4,haD);d(9,H+4,haD);d(10,H+4,ha);d(11,H+4,ha);
  [3,4,5].forEach(x=>{d(x,H+6,'#fff');d(x,H+8,skD);});d(3,H+7,'#fff');d(4,H+7,eye);d(5,H+7,'#fff');
  [9,10,11].forEach(x=>{d(x,H+6,'#fff');d(x,H+8,skD);});d(9,H+7,'#fff');d(10,H+7,eye);d(11,H+7,'#fff');
  d(7,H+8,skD);d(7,H+9,skDD);
  d(4,H+10,skD);d(5,H+10,skDD);d(6,H+10,skDD);d(7,H+10,skDD);d(8,H+10,skDD);d(9,H+10,skD);
  d(5,H+11,skD);d(8,H+11,skD);
  d(3,H+11,skD);for(let x=4;x<12;x++)d(x,H+11,x===7?skL:sk);d(12,H+11,skD);
  d(4,H+12,skD);d(5,H+12,skD);d(6,H+12,skD);d(8,H+12,skD);d(9,H+12,skD);d(10,H+12,skD);
}

function drawMatteo(cr,air,la){
  const sk='#f0d0b0',skD='#c8a070',skDD='#a07040',skL='#fae0c8';
  const ha='#4a2808',haD='#2a1004',haL='#6a3818';
  const sh='#1a5c1a',shD='#0e3a0e',shL='#267a26',shLL='#348034';
  const pa='#c8b080',paD='#a09060',paL='#e0c898';
  const bo='#c89060',boD='#a07040',boDD='#804820',boL='#e0b080';
  const so='#f0f0f0',soD='#d0d0d0';
  const wa='#c0a030',waD='#907010',waL='#e0c050',waFace='#1a1a1a';
  const ball='#5a2808',ballD='#3a1004',ballL='#7a3818';
  const eye='#2a1808';
  const Z=2,BY=39,CX=10;
  ctx.save(); ctx.scale(0.7,0.7);
  const dot = (xn,yn,f) => {pr((xn-CX)*Z,(yn-BY)*Z,Z,Z,f,null);}
  if(cr){
    const BYc=25;
    const dc = (xn,yn,f) => {pr((xn-CX)*Z,(yn-BYc)*Z,Z,Z,f,null);}
    for(let x=1;x<=7;x++)dc(x,24,x===1||x===7?boD:x===2?boL:bo);for(let x=1;x<=7;x++)dc(x,25,boDD);dc(3,23,soD);dc(5,23,soD);
    for(let x=12;x<=17;x++)dc(x,24,x===12||x===17?boD:x===13?boL:bo);for(let x=12;x<=17;x++)dc(x,25,boDD);dc(13,23,soD);dc(15,23,soD);
    for(let x=2;x<7;x++){dc(x,22,so);dc(x,23,soD);}for(let x=12;x<17;x++){dc(x,22,so);dc(x,23,soD);}
    const rows=[[0,1,2,3,4,5,6,7,8],[1,2,3,4,5,6,7,8],[1,2,3,4,5,6,7],[2,3,4,5,6,7],[2,3,4,5,6]];
    for(let i=0;i<rows.length;i++){const lc=i<2?paL:i<4?pa:paD;rows[i].forEach(x=>{const col=x===0?paD:x===rows[i][rows[i].length-1]?paD:lc;dc(x,21-i,col);dc(19-x,21-i,col);});}
    for(let i=0;i<9;i++){dc(1,14-i,shD);for(let x=2;x<18;x++)dc(x,14-i,i===8?shLL:i<3?shL:sh);dc(18,14-i,shD);}
    for(let i=0;i<7;i++){dc(-1,9-i,i<3?shL:sh);dc(-2,9-i,i<2?shLL:shL);dc(20,9-i,i<3?shL:sh);dc(21,9-i,i<2?shLL:shL);}
    dc(-3,10,waD);dc(-2,10,waL);dc(-2,11,waFace);dc(-2,12,waD);
    dc(-4,12,ballL);dc(-3,12,ballL);dc(-2,12,ball);dc(-5,13,ball);dc(-4,13,ball);dc(-3,13,ballD);dc(-2,13,ballD);
    dc(-1,14,sk);dc(20,14,sk);
    mattHead(dc,0);
  } else {
    const lLn=Math.round(la[0][1]/Z),lRn=Math.round(la[1][1]/Z);
    const shoe = (bx,lOff) => {dot(bx,38+lOff,boL);for(let x=bx+1;x<bx+7;x++)dot(x,38+lOff,bo);dot(bx+7,38+lOff,boD);dot(bx+1,38+lOff,soD);dot(bx+3,38+lOff,soD);dot(bx+5,38+lOff,soD);dot(bx-1,39+lOff,boD);for(let x=bx;x<bx+7;x++)dot(x,39+lOff,bo);dot(bx+7,39+lOff,boD);for(let x=bx-1;x<=bx+7;x++)dot(x,40+lOff,boDD);}
    shoe(1,lLn);shoe(11,lRn);
    for(let x=1;x<9;x++){dot(x,36+lLn,so);dot(x,37+lLn,soD);}for(let x=11;x<19;x++){dot(x,36+lRn,so);dot(x,37+lRn,soD);}
    for(let i=0;i<10;i++){const zone=i<3?'top':i<6?'mid':'low';const mc=zone==='top'?paL:zone==='mid'?pa:paD;const yl=27+i+lLn,yr=27+i+lRn;dot(0,yl,paD);dot(1,yl,zone==='top'?paL:pa);for(let x=2;x<=7;x++)dot(x,yl,mc);dot(8,yl,paD);dot(9,yl,paD);dot(9,yr,paD);dot(10,yr,paD);dot(11,yr,zone==='top'?paL:pa);for(let x=12;x<=18;x++)dot(x,yr,mc);dot(19,yr,paD);}
    for(let x=2;x<=7;x++)dot(x,31+lLn,paL);for(let x=11;x<=17;x++)dot(x,31+lRn,paL);
    for(let x=8;x<11;x++){dot(x,27,paD);dot(x,28,paD);}
    for(let x=1;x<19;x++)dot(x,26,paD);for(let x=1;x<19;x++)dot(x,25,pa);dot(9,25,'#c8c8c8');dot(10,25,'#c8c8c8');
    for(let i=0;i<10;i++){const yy=15+i;dot(0,yy,shD);dot(1,yy,i<2?shLL:shL);for(let x=2;x<18;x++)dot(x,yy,i===0?shLL:i<3?shL:i>8?shD:sh);dot(18,yy,i<2?shL:shD);dot(19,yy,shD);}
    dot(4,15,shD);dot(15,15,shD);
    for(let i=0;i<10;i++){dot(-1,15+i,i<2?shL:i>8?skD:sh);dot(-2,15+i,i<2?shLL:i>8?skD:shL);dot(20,15+i,i<2?shL:i>8?skD:sh);dot(21,15+i,i<2?shLL:i>8?skD:shL);}
    dot(-3,22,waD);dot(-3,23,wa);dot(-3,24,waD);dot(-2,22,waL);dot(-2,23,waFace);dot(-2,24,waD);
    dot(-4,23,ballL);dot(-3,23,ballL);dot(-2,23,ball);dot(-5,24,ball);dot(-4,24,ball);dot(-3,24,ballD);dot(-2,24,ballD);dot(-4,25,ballD);dot(-3,25,ballD);
    dot(-1,24,sk);dot(0,24,sk);dot(19,24,sk);dot(20,24,sk);
    for(let x=8;x<=11;x++){dot(x,14,sk);dot(x,13,skD);}dot(6,15,shD);dot(7,15,shL);for(let x=8;x<12;x++)dot(x,15,shL);dot(12,15,shL);dot(13,15,shD);dot(7,14,shD);dot(12,14,shD);
    mattHead(dot,0);
    if(ballCd===0){dot(-2,BY-41,'#44cc44');dot(-1,BY-41,'#44cc44');dot(19,BY-41,'#44cc44');dot(20,BY-41,'#44cc44');}
  }
  ctx.restore();
}

function mattHead(d,H){
  const sk='#f0d0b0',skD='#c8a070',skDD='#a07040',skL='#fae0c8';
  const ha='#4a2808',haD='#2a1004',haL='#6a3818',eye='#2a1808';
  [3,4,5,6,7,8,9,10,11,12,13,14,15,16].forEach(x=>d(x,H,x<6||x>13?haD:ha));d(9,H,haL);d(10,H,haL);
  [2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17].forEach(x=>d(x,H+1,x<4||x>15?haD:x<6||x>13?ha:haL));
  [2,3,4,5,14,15,16,17].forEach(x=>d(x,H+2,x<4||x>15?haD:ha));
  for(let x=3;x<17;x++)d(x,H+3,x<5||x>14?skD:skL);
  for(let i=4;i<13;i++){d(2,H+i,skD);d(3,H+i,skD);for(let x=4;x<16;x++)d(x,H+i,i<6?skL:sk);d(16,H+i,skD);d(17,H+i,skD);}
  d(17,H+5,sk);d(18,H+6,skD);d(18,H+7,skDD);d(17,H+8,sk);d(2,H+5,sk);d(1,H+6,skD);d(1,H+7,skDD);d(2,H+8,sk);
  d(4,H+4,haD);d(5,H+4,ha);d(6,H+4,ha);d(7,H+4,haD);d(11,H+4,haD);d(12,H+4,ha);d(13,H+4,ha);d(14,H+4,haD);
  [4,5,6].forEach(x=>{d(x,H+6,'#fff');d(x,H+8,skD);});d(4,H+7,'#fff');d(5,H+7,eye);d(6,H+7,'#fff');
  [12,13,14].forEach(x=>{d(x,H+6,'#fff');d(x,H+8,skD);});d(12,H+7,'#fff');d(13,H+7,eye);d(14,H+7,'#fff');
  d(9,H+8,skD);d(10,H+9,skD);d(10,H+10,skDD);
  d(7,H+11,skD);d(8,H+11,skDD);d(9,H+11,skDD);d(10,H+11,skDD);d(11,H+11,skDD);d(12,H+11,skD);d(8,H+12,skD);d(11,H+12,skD);
  d(4,H+12,skD);for(let x=5;x<15;x++)d(x,H+12,x===9||x===10?skL:sk);d(15,H+12,skD);
  d(5,H+13,skD);d(6,H+13,skD);for(let x=7;x<13;x++)d(x,H+13,skD);d(13,H+13,skD);d(14,H+13,skD);
}

function drawVictor(cr,air,la){
  const sk='#e8b880',skD='#c09060',skDD='#906030',skL='#f8d8a8';
  const ha='#181818',haD='#080808',haL='#282828';
  const sh='#c02020',shD='#801010',shL='#e03030',shLL='#ff5050';
  const pa='#1e2230',paD='#0e1018',paL='#2e3448';
  const bo='#282828',boD='#141414',boDD='#0a0a0a',boL='#383838';
  const so='#181818',soD='#0a0a0a',eye='#1a1008';
  const Z=2,BY=39,CX=13;
  const victorScale=giant.active?0.85*1.5:0.85;
  ctx.save(); ctx.scale(victorScale,victorScale);
  const dot = (xn,yn,f) => {pr((xn-CX)*Z,(yn-BY)*Z,Z,Z,f,null);}
  // Victor ne s'accroupit pas — la peut valoir null si cr=true
  const lLn=la?Math.round(la[0][1]/Z):0, lRn=la?Math.round(la[1][1]/Z):0;
  const shoe = (bx,lOff) => {dot(bx,38+lOff,boL);for(let x=bx+1;x<bx+9;x++)dot(x,38+lOff,bo);dot(bx+9,38+lOff,boD);dot(bx+2,38+lOff,so);dot(bx+4,38+lOff,so);dot(bx+6,38+lOff,so);dot(bx-1,39+lOff,boD);for(let x=bx;x<bx+9;x++)dot(x,39+lOff,bo);dot(bx+9,39+lOff,boD);for(let x=bx-1;x<=bx+9;x++)dot(x,40+lOff,boDD);}
  shoe(1,lLn);shoe(14,lRn);
  for(let x=1;x<11;x++){dot(x,36+lLn,so);dot(x,37+lLn,soD);}for(let x=13;x<24;x++){dot(x,36+lRn,so);dot(x,37+lRn,soD);}
  for(let i=0;i<10;i++){const zone=i<3?'top':i<6?'mid':'low';const mc=zone==='top'?paL:zone==='mid'?pa:paD;const yl=27+i+lLn,yr=27+i+lRn;dot(0,yl,paD);dot(1,yl,zone==='top'?paL:pa);for(let x=2;x<=10;x++)dot(x,yl,mc);dot(11,yl,paD);dot(12,yl,paD);dot(12,yr,paD);dot(13,yr,paD);dot(14,yr,zone==='top'?paL:pa);for(let x=14;x<=24;x++)dot(x,yr,mc);dot(25,yr,paD);}
  for(let x=2;x<=10;x++)dot(x,31+lLn,paL);for(let x=14;x<=23;x++)dot(x,31+lRn,paL);
  for(let x=11;x<14;x++){dot(x,27,paD);dot(x,28,paD);}
  for(let x=1;x<25;x++)dot(x,26,paD);for(let x=1;x<25;x++)dot(x,25,pa);dot(12,25,'#c0c0c0');dot(13,25,'#c0c0c0');
  for(let i=0;i<10;i++){const yy=15+i;dot(0,yy,shD);dot(1,yy,i<2?shLL:shL);for(let x=2;x<24;x++)dot(x,yy,i===0?shLL:i<3?shL:i>8?shD:sh);dot(24,yy,i<2?shL:shD);dot(25,yy,shD);}
  dot(5,15,shD);dot(20,15,shD);
  dot(9,21,shD);dot(13,21,shD);dot(16,21,shD);dot(9,24,shD);dot(13,24,shD);dot(16,24,shD);
  for(let i=0;i<10;i++){dot(-4,15+i,i<2?shL:sh);dot(-3,15+i,i<2?shLL:sh);dot(-2,15+i,i>8?skD:sh);dot(-1,15+i,i>8?skD:shD);dot(26,15+i,i>8?skD:shD);dot(27,15+i,i>8?skD:sh);dot(28,15+i,i<2?shLL:sh);dot(29,15+i,i<2?shL:sh);}
  dot(-5,18,sh);dot(-5,19,sh);dot(-5,20,sh);dot(30,18,sh);dot(30,19,sh);dot(30,20,sh);
  dot(-4,24,skD);dot(-3,24,sk);dot(-2,24,sk);dot(-1,24,skD);dot(26,24,skD);dot(27,24,sk);dot(28,24,sk);dot(29,24,skD);
  if(air){for(let i=0;i<3;i++){dot(-4,13+i,sh);dot(-3,13+i,sh);dot(-2,13+i,sh);dot(-1,13+i,shD);dot(26,13+i,shD);dot(27,13+i,sh);dot(28,13+i,sh);dot(29,13+i,sh);}}
  for(let x=10;x<17;x++){dot(x,14,sk);dot(x,13,skD);}dot(8,15,shD);dot(9,15,shL);for(let x=10;x<17;x++)dot(x,15,shL);dot(17,15,shL);dot(18,15,shD);dot(9,14,shD);dot(17,14,shD);
  victorHead(dot,0);
  for(let i=0;i<giant.charges;i++){dot(8+i*6,BY-42,'#c02020');dot(9+i*6,BY-42,'#c02020');dot(10+i*6,BY-42,'#ff5050');dot(8+i*6,BY-43,'#801010');}
  ctx.restore();
}

function victorHead(d,H){
  const sk='#e8b880',skD='#c09060',skDD='#906030',skL='#f8d8a8';
  const ha='#181818',haD='#080808',haL='#282828',eye='#1a1008';
  [7,8,9,10,11,12,13,14,15,16,17,18].forEach(x=>d(x,H,x<9||x>16?haD:ha));
  [6,7,8,9,10,11,12,13,14,15,16,17,18,19].forEach(x=>d(x,H+1,x<8||x>17?haD:ha));
  [6,7,18,19].forEach(x=>d(x,H+2,haD));
  for(let x=7;x<19;x++)d(x,H+3,x<9||x>16?skD:skL);
  for(let i=4;i<13;i++){d(5,H+i,skD);d(6,H+i,skD);for(let x=7;x<19;x++)d(x,H+i,i<6?skL:sk);d(19,H+i,skD);d(20,H+i,skD);}
  for(let x=6;x<20;x++)d(x,H+12,x<8||x>17?skD:sk);for(let x=7;x<19;x++)d(x,H+13,skD);
  d(6,H+5,sk);d(5,H+6,skD);d(5,H+7,skDD);d(5,H+8,skD);d(6,H+8,sk);
  d(19,H+5,sk);d(20,H+6,skD);d(20,H+7,skDD);d(20,H+8,skD);d(19,H+8,sk);
  [7,8,9,10,11].forEach(x=>d(x,H+4,x===7||x===11?haD:ha));[14,15,16,17,18].forEach(x=>d(x,H+4,x===14||x===18?haD:ha));
  [8,9,10].forEach(x=>{d(x,H+6,'#fff');d(x,H+8,skD);});d(8,H+7,'#fff');d(9,H+7,eye);d(10,H+7,'#fff');d(9,H+6,'#fff');
  [15,16,17].forEach(x=>{d(x,H+6,'#fff');d(x,H+8,skD);});d(15,H+7,'#fff');d(16,H+7,eye);d(17,H+7,'#fff');d(16,H+6,'#fff');
  d(12,H+8,skD);d(13,H+8,skD);d(11,H+10,skDD);d(12,H+10,sk);d(13,H+10,sk);d(14,H+10,skDD);
  d(10,H+11,skD);d(11,H+11,skDD);d(12,H+11,skDD);d(13,H+11,skDD);d(14,H+11,skDD);d(15,H+11,skD);
  d(7,H+12,skD);for(let x=8;x<18;x++)d(x,H+12,x===12||x===13?skL:sk);d(18,H+12,skD);for(let x=8;x<18;x++)d(x,H+13,skD);
}

function drawCorentin(cr,air,la){
  const sk='#e8c090',skD='#c09060',skDD='#906030',skL='#f8d8b0';
  const mu='#c8a870',muD='#a07840';
  const ha='#4a2808',haD='#2a1004',haL='#6a3818';
  const ba='#5a3010',baD='#3a1808';
  const ca='#3060c0',caD='#1a3880',caL='#5080e0',caLL='#70a0f0';
  const ft='#d8a870',ftD='#b08040',ftDD='#805820';
  const Z=2,BY=39,CX=11;
  ctx.save(); ctx.scale(0.59,0.59);
  const dot = (xn,yn,f) => {pr((xn-CX)*Z,(yn-BY)*Z,Z,Z,f,null);}
  if(cr){
    const BYc=25;
    const dc = (xn,yn,f) => {pr((xn-CX)*Z,(yn-BYc)*Z,Z,Z,f,null);}
    // pieds nus accroupis
    for(let x=1;x<8;x++) dc(x,24,x<3?ftDD:x>6?ftD:ft);
    for(let x=1;x<8;x++) dc(x,25,ftDD);
    for(let x=14;x<21;x++) dc(x,24,x<16?ftDD:x>19?ftD:ft);
    for(let x=14;x<21;x++) dc(x,25,ftDD);
    // jambes courtes repliées nues
    const jD=[[1,2,3,4,5,6,7],[1,2,3,4,5,6,7],[1,2,3,4,5,6],[2,3,4,5,6],[2,3,4,5]];
    for(let i=0;i<5;i++){jD[i].forEach(x=>{const lc=x===1?muD:x===jD[i][jD[i].length-1]?muD:i<2?skL:sk;dc(x,21-i,lc);dc(21-x,21-i,lc);});}
    // caleçon bleu accroupi
    for(let x=1;x<21;x++) dc(x,16,caD);for(let x=1;x<21;x++) dc(x,15,ca);for(let x=2;x<20;x+=3) dc(x,16,caL);
    // torse nu musclé ramassé
    for(let i=0;i<9;i++){
      dc(0,14-i,skD);
      for(let x=1;x<21;x++) dc(x,14-i,i>7?skL:sk);
      dc(21,14-i,skD);
    }
    // pecs
    for(let x=2;x<10;x++) dc(x,12,skL);for(let x=12;x<20;x++) dc(x,12,skL);dc(10,12,muD);dc(11,12,muD);
    // abdos accroupi
    dc(10,10,muD);dc(11,10,muD);dc(10,11,muD);dc(11,11,muD);
    [5,10,16].forEach(x=>{dc(x,10,muD);dc(x,11,muD);dc(x,12,muD);});
    // bras larges
    for(let i=0;i<9;i++){
      dc(-2,6-i,i<2?skL:sk);dc(-1,6-i,i<2?skL:i>7?muD:sk);
      dc(22,6-i,i<2?skL:i>7?muD:sk);dc(23,6-i,i<2?skL:sk);
    }
    dc(-1,14,sk);dc(22,14,sk);
    corentinHead(dc,-10);
  } else {
    const lLn=Math.round(la[0][1]/Z),lRn=Math.round(la[1][1]/Z);
    // pieds nus
    const foot = (bx,lOff,flip) => {
      const d2=flip?-1:1;
      for(let x=0;x<8;x++) dot(bx+d2*x,33+lOff,x===0?ftDD:x>6?ftD:ft);
      for(let x=0;x<9;x++) dot(bx+d2*x,34+lOff,x===0?ftDD:x>7?ftD:ft);
      for(let x=1;x<8;x++) dot(bx+d2*x,35+lOff,ft);
      for(let x=0;x<9;x++) dot(bx+d2*x,36+lOff,'#604020');
    }
    foot(1,lLn,false); foot(20,lRn,true);
    // jambes courtes nues — 4 rangées
    for(let i=0;i<4;i++){
      const zone=i<2?'top':'low';
      const lc=zone==='top'?skL:mu;
      const yl=29+i+lLn,yr=29+i+lRn;
      dot(0,yl,muD);dot(1,yl,zone==='top'?skL:sk);
      for(let x=2;x<=9;x++) dot(x,yl,lc);
      dot(10,yl,muD);
      dot(11,yr,muD);dot(12,yr,zone==='top'?skL:sk);
      for(let x=12;x<=20;x++) dot(x,yr,lc);
      dot(21,yr,muD);
    }
    for(let x=10;x<12;x++){dot(x,29,caD);dot(x,30,caD);}
    // caleçon bleu — y=20..27
    for(let x=1;x<21;x++) dot(x,28,caD);
    for(let x=2;x<20;x+=3) dot(x,28,caL);
    for(let i=0;i<8;i++){
      const zone=i<2?'top':i<5?'mid':'low';
      const mc=zone==='top'?caLL:zone==='mid'?caL:ca;
      const yl=20+i;
      dot(0,yl,caD);dot(1,yl,zone==='top'?caL:ca);
      for(let x=2;x<=9;x++) dot(x,yl,mc);
      dot(10,yl,caD);dot(11,yl,caD);
      dot(12,yl,caD);dot(13,yl,zone==='top'?caL:ca);
      for(let x=13;x<=20;x++) dot(x,yl,mc);
      dot(21,yl,caD);
    }
    // torse nu musclé — y=6..19 (14 rangées, bien visible)
    for(let i=0;i<14;i++){
      const yy=6+i;
      dot(0,yy,skD);dot(1,yy,i<2?skL:sk);
      for(let x=2;x<20;x++) dot(x,yy,i<2?skL:sk);
      dot(20,yy,i<2?skL:sk);dot(21,yy,skD);
    }
    // pecs (relief)
    for(let x=2;x<10;x++) dot(x,8,skL);for(let x=12;x<20;x++) dot(x,8,skL);
    dot(10,7,muD);dot(11,7,muD);dot(10,8,muD);dot(11,8,muD);dot(10,9,muD);dot(11,9,muD);
    // séparation pecs
    for(let y=6;y<19;y++){ dot(10,y,muD); dot(11,y,muD); }
    // abdos (3 rangées, 2 carreaux par côté)
    [11,14,17].forEach(ya=>{
      // gauche
      dot(3,ya,muD);  for(let x=4;x<=7;x++) dot(x,ya,skL);  dot(8,ya,muD);
      dot(3,ya+1,muD);for(let x=4;x<=7;x++) dot(x,ya+1,sk); dot(8,ya+1,muD);
      dot(3,ya+2,muD);for(let x=4;x<=7;x++) dot(x,ya+2,muD);dot(8,ya+2,muD);
      // droite
      dot(13,ya,muD);  for(let x=14;x<=17;x++) dot(x,ya,skL);  dot(18,ya,muD);
      dot(13,ya+1,muD);for(let x=14;x<=17;x++) dot(x,ya+1,sk); dot(18,ya+1,muD);
      dot(13,ya+2,muD);for(let x=14;x<=17;x++) dot(x,ya+2,muD);dot(18,ya+2,muD);
    });
    // bras nus larges (3 colonnes)
    for(let i=0;i<14;i++){
      dot(-3,6+i,i<2?skL:sk);dot(-2,6+i,i<2?skL:i>12?muD:sk);dot(-1,6+i,i<2?skL:muD);
      dot(22,6+i,i<2?skL:muD);dot(23,6+i,i<2?skL:i>12?muD:sk);dot(24,6+i,i<2?skL:sk);
    }
    // biceps saillant
    dot(-4,9,sk);dot(-4,10,skL);dot(-4,11,sk);dot(-4,12,muD);
    dot(25,9,sk);dot(25,10,skL);dot(25,11,sk);dot(25,12,muD);
    if(air){for(let i=0;i<3;i++){dot(-3,4+i,sk);dot(-2,4+i,skL);dot(-1,4+i,sk);dot(22,4+i,sk);dot(23,4+i,skL);dot(24,4+i,sk);}}
    dot(-1,19,sk);dot(0,19,sk);dot(21,19,sk);dot(22,19,sk);
    // cou
    for(let x=8;x<14;x++){dot(x,5,sk);dot(x,4,skD);}
    corentinHead(dot,-10);
    // indicateurs armure
    /* armure dans HUD */
  }
  ctx.restore();
}

/* helper partagé du sprite Corentin */
function corentinHead(d,H){
  const sk='#e8c090', skD='#c09060', skDD='#906030', skL='#f8d8b0';
  const ha='#4a2808', haD='#2a1004', haL='#6a3818';
  const ba='#5a3010', baD='#3a1808', eye='#2a1808';

  /* Cheveux haut */
  [3,4,5,6,7,8,9,10,11,12,13,14,15,16].forEach(x=>d(x,H+0,x<6||x>13?haD:x<8||x>11?ha:haL));
  [2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17].forEach(x=>d(x,H+1,x<4||x>15?haD:x<6||x>13?ha:haL));
  [1,2,3,4,5,15,16,17,18].forEach(x=>d(x,H+2,x<3||x>16?haD:ha));

  /* Chevelure laterale */
  for(let i=3;i<=14;i++){
    d(-1,H+i,i%3===0?ha:haD);
    d( 0,H+i,haD);
    d(19,H+i,haD);
    d(20,H+i,i%3===0?ha:haD);
  }

  /* Visage fond */
  for(let x=3;x<17;x++) d(x,H+3,x<5||x>14?skD:skL);
  for(let i=4;i<13;i++){
    d(3,H+i,skD);
    for(let x=4;x<16;x++) d(x,H+i,sk);
    d(16,H+i,skD);
  }

  /* Contours joues */
  d(3,H+5,sk);  d(2,H+6,skD); d(2,H+7,skDD); d(3,H+8,sk);
  d(16,H+5,sk); d(17,H+6,skD);d(17,H+7,skDD);d(16,H+8,sk);

  /* Sourcils fins */
  d(5,H+5,haD); d(6,H+5,haD);
  d(12,H+5,haD);d(13,H+5,haD);

  /* Yeux — une seule rangee H+7 */
  d(4,H+7,'#fff'); d(5,H+7,eye); d(6,H+7,'#fff');
  d(12,H+7,'#fff');d(13,H+7,eye);d(14,H+7,'#fff');

  /* Nez */
  d(9,H+8,skD); d(10,H+9,skD); d(10,H+10,skDD);

  /* Bouche */
  d(7,H+11,skD);d(8,H+11,skDD);d(9,H+11,skDD);d(10,H+11,skDD);d(11,H+11,skDD);d(12,H+11,skD);

  /* Barbe */
  d(5,H+11,ba); d(6,H+11,baD); d(13,H+11,baD);d(14,H+11,ba);
  d(5,H+12,ba); d(6,H+12,ba);  d(7,H+12,baD); d(12,H+12,baD);d(13,H+12,ba);d(14,H+12,ba);
  d(7,H+13,ba); d(8,H+13,ba);  d(9,H+13,baD); d(10,H+13,baD);d(11,H+13,ba);d(12,H+13,ba);
  d(8,H+12,skD);d(11,H+12,skD);
  d(4,H+12,skD);
  for(let x=5;x<15;x++) d(x,H+12,x===9||x===10?skL:sk);
  d(15,H+12,skD);
  d(5,H+13,skD);d(6,H+13,skD);
  for(let x=7;x<13;x++) d(x,H+13,skD);
  d(13,H+13,skD);d(14,H+13,skD);
}
