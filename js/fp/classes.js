// Who you can be in first person: every kind of soldier (and the two commanders), with their weapon,
// strength, speed and one special ability on G.
import { LOOKS } from '../render/people.js';

const robe = k => (LOOKS[k] && LOOKS[k].robe && LOOKS[k].robe[0]) || '#2e3440';

export const CLASSES = {
  ashigaru:  { name: 'Ashigaru', kanji: '足軽', role: 'Spearman', weapon: 'yari', hp: 100, st: 100, sleeve: robe('ashigaru'), desc: 'Long reach and quick thrusts — keep the enemy at the tip of your spear.' },
  shieldman: { name: 'Shield-bearer', kanji: '盾', role: 'Sword and shield', weapon: 'sword', shield: true, hp: 115, st: 100, sleeve: robe('shieldman'), desc: 'Raise the shield to stop strikes from a wide arc — even arrows. Slower, but hard to kill.' },
  archer:    { name: 'Archer', kanji: '弓', role: 'Yumi longbow', weapon: 'yumi', hp: 85, st: 100, arrows: 24, sleeve: robe('archer'), desc: 'Hold to aim and draw, click to loose. Arrows drop with distance. Kick anyone who gets too close.' },
  samurai:   { name: 'Samurai', kanji: '侍', role: 'Katana', weapon: 'katana', hp: 120, st: 100, sleeve: robe('samurai'), desc: 'Fast, strong cuts. The best all-round fighter.' },
  ninja:     { name: 'Ninja', kanji: '忍', role: 'Ninjatō and kunai', weapon: 'ninjato', hp: 80, st: 120, speed: 1.15, quiet: true, kunai: 4, ability: 'kunai', sleeve: robe('ninja'), desc: 'Very fast but fragile. G throws a kunai. Crouching is almost silent.' },
  sohei:     { name: 'Sōhei', kanji: '僧兵', role: 'Naginata', weapon: 'naginata', hp: 105, st: 100, ability: 'prayer', sleeve: robe('sohei'), desc: 'Wide sweeps that cut two at once. G: a prayer that heals you.' },
  cavalry:   { name: 'Cavalry', kanji: '騎馬', role: 'On horseback, with a lance', weapon: 'lance', hp: 120, st: 100, horse: true, sleeve: robe('cavalry'), desc: 'Gallop with Shift. The faster you ride, the harder the lance hits.' },
  berserker: { name: 'Berserker', kanji: '鬼', role: 'Commander — kanabō', weapon: 'kanabo', hp: 170, st: 120, ability: 'roar', commander: true, sleeve: robe('berserker'), desc: 'Slow and crushing. The heavy strike smashes everything in front. G: a war roar — your next heavy hits all around you.' },
  taisho:    { name: 'Taishō', kanji: '大将', role: 'Commander — katana and war fan', weapon: 'katana', hp: 130, st: 110, ability: 'rally', fan: true, commander: true, sleeve: robe('taisho'), desc: 'A general who fights in front. G: a rally — full stamina and +25% damage for 8 seconds.' },
};
export const ABILITY = {
  kunai: { name: 'Throw a kunai', cd: 0.6 },
  prayer: { name: 'Prayer', cd: 18 },
  roar: { name: 'War roar', cd: 16 },
  rally: { name: 'Rally', cd: 22 },
};
