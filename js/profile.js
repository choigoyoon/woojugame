import { CONFIG } from './config.js';
import { normalizeProgress } from './campaign.js';
import { PARTS, BASE_AVATAR, AVATAR_PALETTE, paletteFor } from './catalog.js';

export { BASE_AVATAR, AVATAR_PALETTE };
const clone = value => JSON.parse(JSON.stringify(value));
const count = n => Number.isSafeInteger(n) && n >= 0 ? Math.min(n, CONFIG.arcade.maxCoins) : 0;
const metric = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
export class FutureSaveError extends Error {
  constructor(){super('A newer app is required to open this save');this.code='FUTURE_SAVE';}
}
const future = raw => {if(!raw)return false;try{return JSON.parse(raw)?.version>CONFIG.arcade.storageVersion;}catch{return false;}};
const emptyStats = () => ({ playMs:0, brakes:0, brakeWins:0, gates:0, gateWins:0, sentences:0, missions:0, missionWins:0 });
const parentDefaults = () => ({ salt:'',hash:'',attempts:0,lockedUntil:0 });

export class Profile {
  constructor(storage) {
    this.status='saved'; this.storage=storage; this.writeProtected=false; this._palette=null;
    this.data={version:CONFIG.arcade.storageVersion,coins:0,equipped:{...BASE_AVATAR},owned:Object.values(BASE_AVATAR),progress:normalizeProgress(),stats:emptyStats(),settings:{haptics:true,sound:true},parent:parentDefaults()};
    try {
      if(storage===undefined)this.storage=globalThis.localStorage;
      if(!this.storage){this.status='memory';return;}
      const primary=this.storage.getItem(CONFIG.arcade.storageKey), backup=this.storage.getItem(CONFIG.arcade.storageKey+'.backup');
      if(future(primary)||future(backup))throw new FutureSaveError();
      if(primary){try{this.read(primary);}catch{if(backup){this.read(backup);this.status='recovered';}else throw Error('No backup');}}
      else if(backup){this.read(backup);this.status='recovered';}
    }catch(error){if(error.code==='FUTURE_SAVE'){this.writeProtected=true;this.status='update-required';}else this.status=this.storage?'recovered':'memory';}
  }
  read(raw) {
    if(future(raw))throw new FutureSaveError();
    const next=clone(this.data);
    if(raw.length>CONFIG.campaign.maxSaveBytes)throw Error('Oversized profile');
    const saved=JSON.parse(raw);
    if(!saved||![1,2,3,CONFIG.arcade.storageVersion].includes(saved.version)||!Number.isSafeInteger(saved.coins)||saved.coins<0)throw Error('Invalid profile');
    next.coins=count(saved.coins);
    next.owned=PARTS.filter(p=>p.price===0||Array.isArray(saved.owned)&&saved.owned.includes(p.id)).map(p=>p.id);
    for(const slot of Object.keys(BASE_AVATAR)){
      const part=PARTS.find(p=>p.id===saved.equipped?.[slot]&&p.slot===slot&&next.owned.includes(p.id));
      next.equipped[slot]=part?.id??BASE_AVATAR[slot];
    }
    next.progress=normalizeProgress(saved.progress);
    for(const key of Object.keys(next.stats))next.stats[key]=metric(saved.stats?.[key]);
    for(const key of ['haptics','sound'])if(typeof saved.settings?.[key]==='boolean')next.settings[key]=saved.settings[key];
    next.stats.brakeWins=Math.min(next.stats.brakeWins,next.stats.brakes);next.stats.gateWins=Math.min(next.stats.gateWins,next.stats.gates);next.stats.missionWins=Math.min(next.stats.missionWins,next.stats.missions);
    const p=saved.parent;
    if(p?.hash&&(!/^[a-f0-9]{64}$/.test(p.hash)||!/^[a-f0-9]{32}$/.test(p.salt)))throw Error('Invalid PIN record');
    if(p){next.parent.attempts=Math.min(5,count(p.attempts));next.parent.lockedUntil=Number.isFinite(p.lockedUntil)?Math.max(0,p.lockedUntil):0;}
    if(p&&/^[a-f0-9]{32}$/.test(p.salt)&&/^[a-f0-9]{64}$/.test(p.hash))next.parent={salt:p.salt,hash:p.hash,attempts:Math.min(5,count(p.attempts)),lockedUntil:Number.isFinite(p.lockedUntil)?Math.max(0,p.lockedUntil):0};
    this.data=next;this._palette=null;
  }
  get coins(){return this.data.coins;}
  get equipped(){return {...this.data.equipped};}
  get palette(){return this._palette??=paletteFor(this.data.equipped);}
  credit(amount){if(!Number.isSafeInteger(amount)||amount<=0)return 0;const added=Math.min(amount,CONFIG.arcade.maxCoins-this.coins);this.data.coins+=added;this.save();return added;}
  addStats(changes,save=true){for(const [key,value]of Object.entries(changes))if(Object.hasOwn(this.data.stats,key)&&Number.isSafeInteger(value)&&value>=0)this.data.stats[key]=Math.min(Number.MAX_SAFE_INTEGER,this.data.stats[key]+value);if(save)this.save();}
  save(){
    if(this.writeProtected)return false;
    if(!this.storage){this.status='memory';return false;}
    try{
      const primary=this.storage.getItem(CONFIG.arcade.storageKey),backup=this.storage.getItem(CONFIG.arcade.storageKey+'.backup');
      if((primary!==this.lastWritten&&future(primary))||(backup!==this.lastWritten&&future(backup))){this.writeProtected=true;this.status='update-required';return false;}
    }catch{this.status='memory';return false;}
    const serialized=JSON.stringify(this.data);
    try{this.storage.setItem(CONFIG.arcade.storageKey,serialized);this.lastWritten=serialized;this.status='saved';}
    catch{this.status='memory';return false;}
    // The primary is authoritative. A failed redundant write cannot roll back a successful purchase.
    try{this.storage.setItem(CONFIG.arcade.storageKey+'.backup',serialized);}catch{/* Primary remains valid. */}
    return true;
  }
  commitBattle(progress,checkpoint,coins=0,stats={}){return this.commitMode('battle',{...progress,checkpoint},coins,stats);}
  commitMode(mode,progress,coins=0,stats={}){
    if(!['battle','runner','plaza','stairs'].includes(mode)||!Number.isSafeInteger(coins)||coins<0)return false;
    this.data.coins=Math.min(CONFIG.arcade.maxCoins,this.coins+coins);
    this.data.progress[mode]=clone(progress);this.addStats(stats,false);return this.save();
  }
  equip(id){const part=PARTS.find(p=>p.id===id);if(!part||!this.data.owned.includes(id))return false;this.data.equipped[part.slot]=id;this._palette=null;this.save();return true;}
  buy(id,authorized=false){
    const part=PARTS.find(p=>p.id===id);if(!part)return 'invalid';
    if(this.data.owned.includes(id)){this.equip(id);return 'equipped';}
    if(this.coins<part.price)return 'coins';
    if(part.legendary&&!authorized)return 'pin';
    this.data.coins-=part.price;this.data.owned.push(id);this.data.equipped[part.slot]=id;this._palette=null;this.save();return 'bought';
  }
  setting(key){if(!['haptics','sound'].includes(key))return;this.data.settings[key]=!this.data.settings[key];this.save();}
  async derivePin(pin,salt){
    const bytes=Uint8Array.from(salt.match(/../g),v=>parseInt(v,16));
    const key=await globalThis.crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
    const hash=await globalThis.crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes,iterations:60000,hash:'SHA-256'},key,256);
    return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
  }
  async setPin(pin){
    if(!/^\d{4}$/.test(pin))return false;
    try{const salt=Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
      const hash=await this.derivePin(pin,salt);this.data.parent={salt,hash,attempts:0,lockedUntil:0};this.save();return true;
    }catch{return false;}
  }
  async verifyPin(pin,now=Date.now()){
    const p=this.data.parent;if(now<p.lockedUntil||!/^\d{4}$/.test(pin))return false;
    let valid=false;
    try{valid=p.hash?(await this.derivePin(pin,p.salt))===p.hash:pin===CONFIG.future.shop.pin;}catch{return false;}
    if(valid){p.attempts=0;p.lockedUntil=0;}else{p.attempts+=1;if(p.attempts>=CONFIG.parent.maxAttempts){p.attempts=0;p.lockedUntil=now+CONFIG.parent.lockMs;}}
    this.save();return valid;
  }
  snapshot(){return{...clone(this.data),status:this.status};}
}
