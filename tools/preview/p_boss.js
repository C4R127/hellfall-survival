const { render, sheet } = require('../lib/model');
const { Img } = require('../lib/image');
const { BOSS_MODELS } = require('../art/bosses');
const rows=[]; for (const t of ['forge','archon']) for (const rage of [false,true]) rows.push([t,rage]);
const s = sheet(8, rows.length, 116, 116, (c, r) => {
  const [t, rage] = rows[r]; const m = BOSS_MODELS[t]; const seq=[]; for (const a in m.anims) for (let f=0; f<m.anims[a]; f++) seq.push([a,f]);
  const [a,f] = c<3 ? ['move',c] : seq[Math.floor((c-3)*seq.length/5)];
  const bg=new Img(116,116); bg.rect(0,0,116,116,'#262b32');
  bg.blit(render(m.fn(a,f,rage),{w:112,h:112,angle: c<3? c*0.8 : 0.4}),2,2); return bg;
});
s.scaled(2).save('tools/preview/out_boss.png');
