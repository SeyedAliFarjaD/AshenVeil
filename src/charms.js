// Charms (Hollow Knight style): bought at bonfires or won from bosses, then
// equipped at a bonfire. Each costs notches; the hero starts with 3 notches
// and every boss felled for the first time grants its charm and one more notch.
export const CHARMS = [
  { key: 'steelheart', name: 'STEEL HEART', notch: 2, drop: 1, color: 0xd8606a, desc: '+40 maximum health' },
  { key: 'wardlesson', name: "WARDEN'S LESSON", notch: 2, drop: 2, color: 0x9fe8ff, desc: 'The parry window lasts 50% longer' },
  { key: 'thorns', name: 'THORNS OF RIME', notch: 1, drop: 3, color: 0x8ad0ff, desc: 'When struck, rime lashes out at foes around you' },
  { key: 'emberbolt', name: 'EMBER BOLT', notch: 2, drop: 4, color: 0xffb347, desc: 'Soul Bolt costs 35 focus instead of 50' },
  { key: 'ironhide', name: 'IRONHIDE', notch: 2, drop: 5, color: 0xc88a50, desc: 'Take 15% less damage from every source' },
  { key: 'antlersigil', name: 'ANTLER SIGIL', notch: 1, drop: 6, color: 0x7affc0, desc: '+25% embers from the fallen' },
  { key: 'queenspoise', name: "QUEEN'S POISE", notch: 2, drop: 7, color: 0xff8aa0, desc: 'A clean parry grants double focus' },
  { key: 'ashencrown', name: 'ASHEN CROWN', notch: 3, drop: 8, color: 0xffc84a, desc: '+25 maximum health and +20% damage' },
  // secret charms: hidden behind false walls (level 2 and level 4)
  { key: 'gravebloom', name: 'GRAVEBLOOM', notch: 2, secret: true, color: 0x7affa0, desc: 'Standing still, your wounds slowly close' },
  { key: 'shadowveil', name: 'SHADOW VEIL', notch: 2, secret: true, color: 0x8a7dff, desc: 'Rolls keep you untouchable 50% longer' },
  { key: 'quickflask', name: 'QUICK FLASK', notch: 1, price: 500, color: 0xffd27a, desc: 'Drink Ember Flasks 60% faster' },
  { key: 'featherstep', name: 'FEATHERSTEP', notch: 1, price: 400, color: 0xe8e4d8, desc: '+20% running speed' },
  { key: 'woundsong', name: 'WOUND SONG', notch: 1, price: 600, color: 0xc48aff, desc: 'Gain 20 focus whenever you are struck' },
  { key: 'longedge', name: 'LONG EDGE', notch: 2, price: 700, color: 0xcfe2f0, desc: 'Your blade reaches 25% further' },
  { key: 'lightstep', name: 'LIGHT STEP', notch: 2, price: 800, color: 0x9affc0, desc: 'Rolls and dashes cost half the stamina' },
  { key: 'ashenfury', name: 'ASHEN FURY', notch: 3, price: 1400, color: 0xff6a3a, desc: '+25% damage with every blow and spell' },
  { key: 'secondwind', name: 'SECOND WIND', notch: 1, price: 550, color: 0x7aff8a, desc: 'A clean parry restores 60 stamina' },
];

export const CHARM = Object.fromEntries(CHARMS.map((c) => [c.key, c]));
export const BASE_NOTCHES = 3;
export const MAX_NOTCHES = 9;
