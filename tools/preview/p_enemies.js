const { render, sheet } = require('../lib/model');
const { Img } = require('../lib/image');
const { ENEMY_MODELS } = require('../art/enemies');
const types = Object.keys(ENEMY_MODELS);
const rows = [];
for (const t of types) { rows.push([t,'dirs',false]); rows.push([t,'anims',false]); rows.push([t,'anims',true]); }
const S=60;
const s = sheet(10, rows.length, S, S, (c, r) => {
  const [t, mode, elite] = rows[r]; const m = ENEMY_MODELS[t];
  const bg = new Img(S,S); bg.rect(0,0,S,S, (r%3===0)?'#2a2f37':'#252a31');
  const sz = Math.round(m.size*(elite?1.25:1));
  let im;
  if (mode==='dirs') { if (c>=8) return bg; im = render(m.fn('move',0,elite), {w:sz,h:sz,angle:c*Math.PI/4, scale: elite?1.25:1}); }
  else { const seq=[]; for (const a in m.anims) for (let f=0; f<m.anims[a]; f++) seq.push([a,f]); const k = Math.floor(c*seq.length/10); const [a,f]=seq[k]; im = render(m.fn(a,f,elite),{w:sz,h:sz,angle:0.35, scale: elite?1.25:1}); }
  bg.blit(im, Math.floor((S-im.w)/2), Math.floor((S-im.h)/2)); return bg;
});
s.scaled(3).save('tools/preview/out_enemies.png');
