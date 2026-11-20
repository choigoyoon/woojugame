import { CONFIG } from './config.js';
export const BASE_AVATAR = Object.freeze({ head: 'pilot', body: 'coral', back: 'none' });
export const PARTS = Object.freeze([
  { id:'pilot',slot:'head',name:'파일럿',price:0,color:'#39cbd6' },
  { id:'visor',slot:'head',name:'네온 고글',price:CONFIG.shop.normalPrices.visor,color:'#8d88ff' },
  { id:'cat',slot:'head',name:'우주 고양이',price:CONFIG.shop.normalPrices.cat,color:'#ffadcf' },
  { id:'crown',slot:'head',name:'태양 왕관',price:CONFIG.shop.legendaryPrice,color:'#ffd56e',legendary:true },
  { id:'coral',slot:'body',name:'코랄 슈트',price:0,color:'#ff7c64' },
  { id:'mint',slot:'body',name:'민트 레이서',price:CONFIG.shop.normalPrices.mint,color:'#55dbc1' },
  { id:'armor',slot:'body',name:'코스모 갑옷',price:CONFIG.shop.normalPrices.armor,color:'#929df4' },
  { id:'solar',slot:'body',name:'태양 기사',price:CONFIG.shop.legendaryPrice,color:'#ffc45c',legendary:true },
  { id:'none',slot:'back',name:'가볍게',price:0,color:'#a9c4e7' },
  { id:'cape',slot:'back',name:'별빛 망토',price:CONFIG.shop.normalPrices.cape,color:'#b395ff' },
  { id:'jet',slot:'back',name:'로켓 팩',price:CONFIG.shop.normalPrices.jet,color:'#62ddeb' },
  { id:'wings',slot:'back',name:'은하 날개',price:CONFIG.shop.legendaryPrice,color:'#ffe5a2',legendary:true },
]);
export const AVATAR_PALETTE = Object.freeze({ helmet:'#39cbd6',helmetTop:'#a2fff1',helmetSide:'#248eab',shirt:'#ff7c64',shirtTop:'#ffa58a',shirtSide:'#bd505b' });
const shade=(hex,factor)=>'#'+[1,3,5].map(i=>Math.round(Math.min(255,parseInt(hex.slice(i,i+2),16)*factor)).toString(16).padStart(2,'0')).join('');
export function paletteFor(equipped) {
  const head=PARTS.find(p=>p.id===equipped.head)?.color??AVATAR_PALETTE.helmet;
  const body=PARTS.find(p=>p.id===equipped.body)?.color??AVATAR_PALETTE.shirt;
  return {helmet:head,helmetTop:shade(head,1.35),helmetSide:shade(head,.65),shirt:body,shirtTop:shade(body,1.3),shirtSide:shade(body,.65),parts:{...equipped}};
}
