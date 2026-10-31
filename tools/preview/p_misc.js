const { Img } = require('../lib/image');
const fs=require('fs'); const zlib=require('zlib');
// decode our own PNGs (filter 0 only)
function load(p){ const b=fs.readFileSync(p); let i=8, w,h, idat=[]; while(i<b.length){ const len=b.readUInt32BE(i); const t=b.toString('ascii',i+4,i+8); const d=b.slice(i+8,i+8+len); if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);} if(t==='IDAT') idat.push(d); i+=12+len;} const raw=zlib.inflateSync(Buffer.concat(idat)); const im=new Img(w,h); for(let y=0;y<h;y++) raw.copy(Buffer.from(im.data.buffer), y*w*4, y*(w*4+1)+1, (y+1)*(w*4+1)); return im; }
const M=JSON.parse(fs.readFileSync('assets/manifest.json'));
const out=new Img(640,560); out.rect(0,0,640,560,'#3a3f47');
let x=4,y=4,rowH=0;
function put(im){ if(x+im.w>636){x=4;y+=rowH+4;rowH=0;} out.blit(im,x,y); x+=im.w+4; rowH=Math.max(rowH,im.h); }
put(load(M.atlases.floors.path)); for (const s of ['steel','lab','concrete']) put(load(M.atlases['walls_'+s].path));
for (const k in M.images) if (k.startsWith('prop_')||k.startsWith('pickup')) put(load(M.images[k].path));
for (const k in M.sheets) if (k.startsWith('pickup_')) put(load(M.sheets[k].path));
for (const k in M.images) if (k.startsWith('icon_')) put(load(M.images[k].path));
for (const k in M.images) if (k.startsWith('weapon_')||k==='logo'||k.startsWith('ui_')) put(load(M.images[k].path));
out.scaled(2).save('tools/preview/out_misc.png');
module.exports={load};
