const { render, sheet } = require('../lib/model');
const { Img } = require('../lib/image');
const PL = require('../art/player');
const angles = [0,1,2,3,4,5,6,7].map(i=>i*Math.PI/4 + 0.2);
const weapons = ['pistol','shotgun','rifle','plasma','launcher','tesla'];
const s = sheet(8, 9, 48, 48, (c, r) => {
  const a = angles[c];
  const bg = new Img(48,48); bg.rect(0,0,48,48,'#2a2f37');
  if (r < 6) {
    const legs = render(PL.legs('walk', c % 6), { w: 32, h: 32, angle: a });
    const tor = render(PL.torso(weapons[r], 'idle', 0), { w: 48, h: 48, angle: a });
    bg.blit(legs, 8, 8); bg.blit(tor, 0, 0); return bg;
  }
  if (r === 6) { const tor = render(PL.torso('rifle', 'reload', c%4), { w: 48, h: 48, angle: a }); bg.blit(render(PL.legs('idle',0),{w:32,h:32,angle:a}),8,8); bg.blit(tor,0,0); return bg; }
  if (r === 7) { bg.blit(render(PL.death(c), { w: 48, h: 48, angle: 0.3 }), 0, 0); return bg; }
  bg.blit(render(PL.legs('run', c % 6), { w: 32, h: 32, angle: 0 }), 8, 8); return bg;
});
s.scaled(4).save('tools/preview/out_player.png');
