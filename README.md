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

The soundtrack is generated live in the browser — nothing to download. By default it plays a **Mix** that rotates like a game soundtrack: a few minutes of one piece, a quiet pause, then the next:

- **Ambient piano** — slow ringing chords and a few quiet notes, lots of space.
- **Tenka theme** — the game's own melody as a C64-style chiptune: pulse-wave lead, shimmering arpeggios, bouncing bass, drums.
- **Calm koto** — koto phrases over a drone, shakuhachi, wind chimes at night; made up as it plays.

Raids and battles break in with an up-tempo version of the Tenka theme. It all starts with your first tap; pick a style, switch music off or set the volume in the menu.

## The goal: Tenka

Unify the land. Storm the **Shogun's Castle** (marked on the map from the start: about 50 defenders, a lord and a keep to capture), or break every rival clan. Either way you win — and can rule on.

## Rival clans and diplomacy

Three clans — the **Uesugi**, **Mōri** and **Hōjō** — each hold a castle and the lands around it (their colours fly over their places on the map). They grow, take places from bandits and from each other, and — while they are your rivals or at war with you — raid your village from Keep level 4 and attack the places you hold. On the map, **Clans & diplomacy** lets you send gifts, spy on them, offer a truce, form an alliance (allies never raid you and send gifts), arrange a marriage, demand tribute if they fear you, or declare war. Taking or burning their places makes them declare war; lose every place and a clan falls.

## Tasks, the guide, the chronicle

New lords get a **guide** (the Tasks row, bottom-left) through the first steps. After that, **tasks** with rewards keep coming — three at a time. The **Chronicle** (menu, or from Tasks) records your clan's story, keeps statistics, and lists 22 **achievements**.

## The year and village life
- **Seasons** change every 3 days. In spring the sakura bloom. Summer grows the most. In autumn the maples turn red. Winter brings snow and bare trees, and the fields stop growing. Rain and snow fall, and the clock shows the season and the weather.
- **Mood.** Food, sake, harmony, festivals, grief after raids and the season all move it. Happy villagers work faster, have children and draw families in. Miserable ones leave. Tap the Mood row to see why.
- **Festivals** (from the Keep or the Mood window) cost food and sake, or gold. They bring lanterns, dancing and a big lift in mood.
- **Children** play around the village and grow up after 2 days.
- **Events:** fires (villagers run to put them out), crop blight, a wandering monk, a rōnin for hire, refugees, storms and good harvests.
- **New buildings:**
  - Iron Mine → iron.
  - Sake Brewery → sake from wheat.
  - Blacksmith → uses iron to forge blades. While the forge burns, your soldiers hit harder and last longer.
  - Market → sell and buy goods, plus travelling merchants with special deals.
- **Speech bubbles** show what villagers think. You can turn them off in the menu.

## Veterans, new troops and battlefield conditions
- **Ranks.** Every kill and every battle survived counts. The ranks are Recruit → Veteran ★ → Elite ★★ → Hero ★★★, and each rank makes a soldier 10% stronger (in battles and in raids on your village). A soldier's panel shows their rank and record.
- **New troops from the Dojo:**
  - **Ninja** (Keep 3): hard to see, quick even when creeping, and kills any unaware guard in one blow. Grappling Hook (R) climbs over walls.
  - **Warrior monks** (Keep 3 + a Shrine): a sweeping naginata. They heal the soldiers around them, and Prayer of Iron (R) halves damage nearby.
  - **Cavalry** (Keep 3 + Stables): very fast, and a charge after a gallop hits 2.5× as hard.
- **Catapults** (Siege Workshop, Keep 4) throw boulders at walls and towers from 30 paces. The crash hurts the men standing nearby too.
- **Squads.** J, K and L select your own groups. Shift+J/K/L, or Shift+click on the squad button, saves the current selection to it.
- **Formations** (Y): Block, Line (fighters in front, bows behind), Wedge, or Loose (against arrows and boulders).
- **Conditions:**
  - Night and fog shorten how far the guards can see.
  - Rain weakens archers.
  - Snow slows everyone.
  - Some places have a river across the field, with two bridges and a slow ford.

## Roads, trade and new places
- **Roads.** Every place you hold, and every town you trade with, gets a road from your village on the map. Armies march 60% faster along your roads: to reach a far place they take the road to your nearest held place, then cross open country.
- **Mountain Temples** (neutral):
  - Make an offering to lift your village's mood.
  - Once they know you, the monks will send you a warrior monk.
- **Market Towns** (neutral):
  - Open a trade route for gold every minute.
  - Bandits or hostile clans near the road can rob the caravans. Clear them to make the road safe.
  - You can also hire rōnin here.
- **Mountain Passes:** bandits hold a narrow gap between cliffs behind a palisade and two towers. Every pass you hold makes all your armies march 15% faster.
- The map of an existing save keeps all its old places; the new ones are simply added.
