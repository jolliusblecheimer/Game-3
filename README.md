# Tenka 天下 — Rise of the Clan

A samurai-era strategy game in 3D that runs in the browser. Build your clan's village in a mountain valley, put your villagers to work, raise an army, and (in later stages) scout the country and lay siege to rival castles.

Runs on an iPad with a keyboard and trackpad, on a laptop, or with touch. Nothing to install: open the page and play. Your village is saved automatically in the browser on that device.

## Playing locally

Browsers don't run JavaScript modules straight from a file on disk, so start a small web server in this folder:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Controls

| Input | Action |
|---|---|
| Drag the ground | Move the camera |
| Two-finger scroll | Move the camera |
| Pinch / Z X | Zoom |
| Q / E, the Turn buttons, a sideways two-finger swipe or Option+drag | Turn the camera |
| G or the Move button | Move mode: drag any building to a new spot |
| Roads, walls, fences | Click start and end, or press and drag; the tool stays ready for the next line |
| W A S D / arrows | Move the camera |
| Click | Select a building or villager |
| B | Show / hide the build menu |
| R | Rotate while placing |
| Shift + click | Place the same building again |
| M | Country map (and back) |
| Delete | Demolish (press twice) |
| Space | Pause |
| F | Game speed 1× / 2× / 3× |
| Esc | Cancel / close |
| H | Help |

## How it works

- **A slow, calm pace.** You start with 10 villagers. New families arrive only now and then (and only if there is room and wheat), so every villager counts.
- **Jobs.** Hire unemployed villagers at fields, lumber camps, quarries and mines; they plant and harvest, fell trees, swing picks at the rock face and disappear into the mine, then carry goods into storage. Anyone without a job builds, upgrades, repairs walls and clears land. Click a worker and press **Aid construction** to lend a hand; they return to their job when the work is done.
- **Progression.** The Keep has 5 levels. Each level adds homes and storage, raises how many of each building you may have, and unlocks new buildings (gold mine and dojo from the start; stone roads, archery range and towers at 2; stone walls, shrine and siege workshop at 3; commanders at 4 and 5). With a limited number of workplaces, upgrading them matters: each level adds a worker and makes everyone there 25% faster. Most buildings can be upgraded too, and workplaces grow bigger at levels 3 and 5.
- **Defense.** Bandits raid the village from time to time — the bigger your Keep, the bigger the band. They break through palisades and walls, fight your soldiers and steal from storage. Spearmen fight them, archers shoot from towers, and everyone else hides indoors. Start with bamboo palisades; stone walls (expensive but strong) come at Keep level 3.
- **Harmony:** shrines, gardens, koi ponds, tea houses, sakura trees and lanterns make everyone work faster.
- **Clear land:** mark trees and boulders and your free villagers remove them.

## The country and raids

- **Map (M):** your province, hidden under golden clouds. Click anywhere to send a scout; the farther away, the longer the trip. Scouts uncover bandit camps, rival villages, clan forts, daimyō castles and ruins with treasure, and learn a place's defenses when they get close.
- **Raids:** pick your soldiers, commanders and battering rams and march. When the army arrives, you lead the battle yourself: drag to select, click to move, click an enemy or a gate to attack. The battle starts paused so you can plan.
- **Tactics:** archers on towers and walls shoot farther and harder. Your troops hiding in bushes can only be seen up close. Rams break gates; swords barely scratch them. The **Berserker** climbs straight over walls and draws every archer's fire; the **Taishō**'s banner makes nearby troops fight harder and can rally them.
- **After a victory:** plunder the place (big loot, it's left in ruins) or hold it with a garrison: it pays tribute every minute but may be attacked.
- **Battle keys:** 1–4 select spearmen / archers / commanders / rams, 5 selects all, T attack-move, G hold, X stop, R commander ability, Space pause, double-click a unit to select all of its type.

Commanders are appointed at the Keep; rams are built at the Siege Workshop.

## Roadmap

1. Village — done
2. Country map, scouting, raids with direct control, holding and plundering — done
3. **Next:** research trees for every troop type (faster scouts and marches, stronger units), enemy counter-raids on your village, more unit types (cavalry, ninja scouts), tougher castle layouts.

## Tech

Plain JavaScript modules and [three.js](https://threejs.org) (r170, included in `lib/`). No build step. Every model is generated in code; there are no image or model files.

```
index.html          entry page
css/style.css       interface styling
js/main.js          boot and game loop
js/game/            simulation: data, world, villagers, pathfinding grid
js/render/          3D: stage (sky, light, day/night), terrain, buildings, people
js/ui/              camera, input, interface
lib/                three.js
```

## Bandit raids

Bandits only come once you have your first soldier, and the first band is two weak outlaws that one spearman can handle. They sneak in quietly: villagers keep working until one of your soldiers spots them (towers and walls see further). If you see them first, click a bandit to raise the alarm. Too slow, and they kill villagers caught outside or loot your storage.

## Hideouts

Small bandit hideouts lie close to your village on the map: three outlaws and no walls, a good first target for two spearmen.

## Scouts

Unemployed villagers and soldiers can scout. Workers stay at their jobs.

## Wounds and healing

Soldiers keep their wounds after battles and raids and heal slowly at home. Build a **Healer's House** (Military) and the wounded go there to rest, healing four times faster. In battle, a soldier pulled out of the fight binds his wounds: after a few seconds without being hit or striking, he slowly regains health. Wounded soldiers are marked on the Army screen, and the healthiest are sent first when you march.

## Battles

- Everyone is much tougher, so fights last longer.
- Enemy foot soldiers who are shot at charge the shooter (they even come out through their own gate). Hidden archers far off in a bush stay hidden.
- **Shield-bearers** turn aside most arrows from the front — hit them from the side or behind.
- **Attack from two sides:** when you march, split your troops into a west and an east group; they start on opposite flanks.
- Plundered places are crossed out on the map.

## Warlord castles

Two **Warlord Castles** stand closer in and are marked on the map from the start (the Daimyō Castles lie further out). From **Keep level 4**, the nearest warlord castle still standing sends real soldiers against your village instead of bandits — spearmen, shield-bearers, archers who shoot at anyone outside, and samurai. Take or burn the castle and its raids stop; when both have fallen, only bandits are left.

## Small castles

Three **Small Castles** lie between the hideouts and the forts: stone walls, two gate towers, a gate, a keep to capture and spikes before the gate. The defenders use the full castle tactics — sentries, a two-rank spear line with shield-bearers behind the gate, archers on the towers and walls, a samurai reserve at the keep, falling back to the keep when the line breaks — with 12 men instead of 20–30.

## Outwitting the defenders

Before the alarm every defender keeps watch, and you can play him:

- **Sight cones.** A man on the ground only sees what is in front of him (and hears footsteps right behind him); tower archers see all round. The red zone shows exactly this — come from behind.
- **Suspicion.** What a guard glimpses makes him suspicious (**?**) — slowly at the edge of his sight, fast up close, much slower if you creep in Stealth. He stops and stares; if you disappear, he walks over to look, searches for a few seconds and goes back. Only when he is sure does he sound the alarm (**!**).
- **Distract (F).** Throw a stone: guards within earshot turn to look, and one or two walk over to check — even out through their own gate. Use it to turn heads while you slip past, or to lure a guard away from the others.
- **Silent takedowns.** Strike an unaware guard from behind while sneaking and he drops without a sound (samurai only stagger).
- **Bodies.** A patrol that finds a body raises the alarm — take out sentries where no one will walk past, or move fast.
- **After the alarm** a lone soldier or two out in the open tempts up to three defenders through the gate — lead them into your hidden troops. A man who is struck calls the two beside him, and a broken wall draws the nearest men to plug the breach.

## Shield-bearers and samurai

Your Dojo can train more than spearmen: choose what it trains in its panel. **Shield-bearers** (Keep level 2) carry a heavy shield that turns most arrows aside from the front — send them first at a castle. **Samurai** (Keep level 4) are sworn warriors, twice as tough as a spearman and deadly with the katana, but take long to train and cost gold. In battle, select them with 6 and 7.

## Music

A calm soundtrack is generated live in the browser (nothing to download): by day a koto plays slow phrases in the Japanese yo scale over a soft drone, with the occasional shakuhachi; at night it turns to the in scale with wind chimes; raids and battles bring taiko drums. It starts with your first tap. Switch it off or set its volume in the menu.
