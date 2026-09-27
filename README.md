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

## Sound, looks, settings and offline play
- **Sound effects** (Menu → Sound effects), all synthesised: clashing steel, arrows, catapult boulders, falling walls, the war horn, the village alarm bell, festival drums, coins at the market, and a fanfare when a soldier rises in rank.
- **Chimney smoke** rises from homes (more in winter), the forge and the brewery.
- **Settings** (Menu):
  - Difficulty: Easy, Normal or Hard, stored with each save.
  - The fastest game speed: 3×, 5× or 10×.
  - A left-handed layout: Map, Turn and Move on the left.
  - "Keep it smooth": the resolution drops automatically on a slow device and comes back when there is room.
- **Big villages:** people far from where you're looking animate less often.
- **Save file / save code** (Menu): there is no cloud save, because the game has no server. Download your village as a file (on iPad it goes to Files → Downloads) or copy the save code. Then load it on any other device.
- **Offline / app:** open the game once online, then use Share → *Add to Home Screen*. It gets its own icon, starts full screen and works without internet. Updates still arrive whenever you're online.

## More land, and merging houses
- The building area is now **72×72 cells** (it was 48×48): more than twice the room. Older saves are converted automatically. Every building, felled tree and cleared rock stays exactly where it was, and the new land is added evenly around the edges.
- **Samurai Manor:** select a Minka House at the top level and choose *Merge*. It joins with another top-level house into a Samurai Manor.
  - The manor holds 20 people (28 when upgraded) instead of 16, and frees two house plots.
  - If the two houses stand side by side, the manor takes their place. Otherwise the nearest top-level house is taken down and its family moves in.

## Defending the village (reworked)
- **Raiders come from far away:** they appear out in the hills, visible when you zoom out, and walk in. "Show me" on the raid banner points the camera at them.
- **Clan armies** (from Keep level 4) come in one to three groups from different sides:
  - They form up out in the hills, then attack.
  - A battering ram goes for your gate.
  - Shield-bearers hack at the weakest stretch of wall while the rest wait for the breach, out of reach.
  - Archers shoot your men off the walls and send fire arrows into the village.
  - When a wall or gate falls, everyone storms in. Cut down to a third, a group breaks and runs.
  - Raiders push through woods (slowly), so a forest isn't a wall.
- **Command your soldiers during a raid:**
  - Click soldiers to select them (Shift adds, double-click selects all of that kind). Or use the bar at the bottom: 1 all, 2 spears & shields, 3 archers, 4 samurai & elite.
  - Then click the ground to send them there (they hold it), an enemy to attack it, or an upgraded stone wall to man it.
  - C: charge. V: man the walls. K: let them fight on their own. Esc: deselect.
- **On their own:**
  - Archers take the towers, then the wall walks near the attack.
  - Many spearmen and shield-bearers climb onto the wall above the point under attack and stab down at the enemy.
  - The rest stand ready behind it, and anyone who gets inside is hunted down.
- **Wall patrols:** soldiers walk the wall walks of upgraded (level 2+) stone walls in peacetime, from the moment you have them. It no longer waits for Keep level 4 and needs only 2 connected pieces. Archers join when the towers are full.

## Sieges, part 2
- **Castle battles on the map:**
  - About 40 seconds after the alarm, a relief column marches in from behind the castle and falls on your army from the rear (Clan Forts and bigger).
  - When they outnumber you 3 to 2, the defenders sally out of the gate in force.
  - Cut down to 40%, the last of them make a last stand at the keep.
- **Battlefields look better:**
  - Seasonal grass with a trampled trail to the gate and a packed-earth courtyard.
  - Woods of pine, cedar, maple and cherry. Boulders, grass tufts and flowers. Real mountains beyond.
  - Clan banners on the keep, towers and gate. Torches and firelight at night.
  - Sparks and splinters on every hit, dust and rubble when a wall falls, and smoke rising from the ruins.
- **Ladders in village raids:** some attackers carry ladders to a stretch of wall that nobody is guarding. A soldier on the wall nearby throws the ladder down. If nobody does, they climb over, one after another.
- **Towers can be broken now** (they have strength, like walls). The archers on a falling tower come down with it.
- Health bars show over all your soldiers in a fight.
- When one of your held places is attacked while you're away, you get a **report**: how many came, whether it held, and who fell.
- **Next raid:** the clan panel shows roughly when the next raid is due, and scouts warn you about a minute before it arrives.
- The thick ring of trees where your land used to end is much thinner.

## Eras, research and Great Buildings (reworked)
- **Six eras:** Village → Fortified Village → Castle Town → Daimyō's Domain → Contender for the Realm → Shogunate.
- **Wisdom (智)** gathers every minute, and keeps gathering while you're away:
  - Each Strategy Hall level adds more Wisdom per minute and more storage; the hall can now be upgraded to level 3.
  - The Great Buddha adds more still.
  - Battles you win, raids you beat off, temple offerings and tasks give extra Wisdom.
- **Research** (Wisdom in the clan panel, or the Strategy Hall):
  - Put Wisdom into a technology; when it's full, pay the goods to complete it. There are 45 technologies across the six eras, including all the old skill-tree bonuses. Anything you had already learned stays learned.
  - Each era's key technology (★) is what lets the Keep grow to its next level. Keeps that had already grown count as having reached those eras.
  - The Shogun's castle can only be attacked, and the realm only won, once you hold the **Imperial Mandate**.
- **Great Buildings (wonders):**
  - Nine of them: Kinkaku-ji, the Great Buddha, the Itsukushima Torii, the White Heron Keep, the Great Temple Bell, the Thousand Gates of Inari, Osaka Castle, the Hall of a Thousand Kannon and Nijō Palace.
  - To build one, you need 5 blueprints (from battles, raids you beat off, temples and tasks). Then invest Wisdom to raise it to level 10.
  - Each one gives a bonus that grows with its level: mood, Wisdom, trade, stronger walls, faster training, gold, army strength, healing, homes and tribute.

## Roads
- Every working building (homes, fields, workshops, storehouses, wonders) must be connected to the Keep by a road. Roads may run through gates.
- A building without a road does nothing: no workers, no homes, no storage. It shows a red 道 sign.
- In a building's panel, "Lay the road for me" builds free dirt roads for you. The clan panel counts the buildings that have no road.
- Decorations, walls, gates and towers don't need roads.

## The map
- Unexplored land lies flat under the clouds. The hills and woods rise as your scouts uncover them.
- Rivers, lakes and the sea now have water.
- Labels no longer pile up on top of each other.
- The side panel's buttons no longer vanish under your finger.

## The Scholars' Pavilion and the research tree
- **Scholars' Pavilion (書院)** (Village tab, from Keep level 1):
  - It's where your clan does its research. Without it, Wisdom only trickles in (0.25 a minute).
  - With it you get 1 a minute, and each of its 5 levels adds more Wisdom and more room to store it. The Strategy Hall adds a little more on top.
  - It's a raised hall of dark timber and glowing shoji in a moss garden, with a lotus pond, a cloud-pruned pine, a red maple and a stone lantern. Each level adds more: a scroll rack and a red arched bridge, then a two-storey library, a lantern path, and a golden finial and a bell.
- **Research: one scroll for each era**, ink and gold:
  - Six rolled-up scrolls at the top: finished eras carry a red mark, and you can peek at the ones ahead. The scroll for the era you're in opens by itself.
  - The tree reads from top to bottom. It grows from what you mastered before (the previous era's key technology), down golden branches through each path of the era (Spears, Bows, Walls…), with a medallion for every technology.
  - All paths meet at the bottom in the era's ★ key technology. Complete it and the scroll rolls up while the next era's scroll unrolls.
  - The medallions:
    - **Learned:** glow vermilion.
    - **Can study now:** glow gold, with a ring that fills as you put Wisdom in.
    - **Locked:** carry a small lock.
    - **Branches:** light up gold once the step before is learned.
  - Tap a medallion to see what it does and what it needs, then invest Wisdom or complete it.
- **Troops come from research:** shield-bearers, ninja, warrior monks, cavalry, samurai, both commanders and catapults.
- **Move mode:** Move and Demolish only show up in Move mode. Press Move or G, then drag a building, or tap it to demolish it.

## Every upgrade does something
- A building's upgrade section now says what the **next level** brings: more homes, more workers, faster work, more Wisdom, and so on.
- **Market:** merchants collect market fees (gold every round at the stalls), and more at a bigger market. Its levels also give better prices.
- **Blacksmith:** while the forge burns, your soldiers are stronger, and the whole village works faster with better tools. Both grow with every level.
- **Castle Gate:**
  - Level 2: iron-banded, so rams do 30% less damage.
  - Level 3: murder holes, so boiling oil burns anyone battering it.
- **Stone Wall:**
  - Level 2: a walkway for patrols and fighting from above.
  - Level 3: battlements, so soldiers on it take 35% less damage and strike 20% harder.
- **Kyūdō Range and Dojo:** each level lets one more trainee train at a time, and training goes 25% faster.
  - The Range's masters drill **all** your archers: +5% range and +4% damage per level above 1. The Dojo's masters give all spearmen +4% damage per level.
  - Graduates of an upgraded school leave with experience. From level 3 they are already **Veterans ★**.

## The War Room (Strategy Hall)
- The Strategy Hall is where your **commanders learn their skills**. Each commander has his own skill tree, with three tiers of two paths:
  - **Berserker:** Iron Hide, Oni Strength → Quick Climb, Great Cleave → Bloodlust, Unstoppable.
  - **Taishō:** War Council, Tall Banner → Swift Orders, Banner of Courage → Living Legend, Iron Discipline.
- **Command points:**
  - Commanders earn them by fighting: every battle they survive, and every 5 enemies they fell.
  - **War games** at the Hall buy extra points for goods, and cost more each time.
  - Skills cost 1, 2 or 3 points by tier.
- The Hall's level opens the tiers: level 2 opens tier II, level 3 opens tier III. Its scholars still add Wisdom.
- Commander skills are no longer part of the era research. Anything already researched carries over.

## Quests, claims and diplomacy
- **Main quest line:** 21 steps that guide you through the whole game.
  - The steps run from the first Lumber Camp to unifying the land.
  - Each step says what to do and where to find it.
  - When a step is done, you **claim** its reward yourself in the Quests window. Then the next step appears.
- **Side tasks** don't pay out on their own any more. They wait with a **Claim** button.
  - The Quests row in the clan panel lights up when a reward is waiting.
- **Dojo classes need a bigger Dojo** as well as the research:
  - Shield bearer: level 2.
  - Ninja, sōhei and cavalry: level 3.
  - Samurai: level 4.
- **The Strategy Hall** opens at **Keep level 4**, with your first commander.
- **Deals:**
  - The travelling merchant brings out a new offer each time you take one.
  - Market towns with a trade route have a **Deal of the day** that changes after every deal.
- **Gathering is fairer:**
  - Wheat is slower: 6 per harvest.
  - Stone, gold and iron are faster: stonecutter 8 every 12 s, miners 6 and 5 every 14 s.
- **Diplomacy window, redone:**
  - One tab per clan.
  - A plain explanation of what your current standing means.
  - The road from war to marriage.
  - A labelled feelings bar with the alliance (40) and marriage (65) marks.
  - The **best next step**.
  - Every action with its cost and the reason when you can't do it yet.
- **Ground detail:**
  - Raked sand on the Kyūdō Range, Dojo yard and Strategy Hall garden.
  - Chips, cracks, rock strata and drill holes at the Stone Quarry.
  - Soot and a coal heap at the smithy.
  - Straw and a trough in the stable.
  - Sawdust and timber at the workshop.
  - Makiwara straw targets.

## Iron armour, the Quests scroll, Wisdom, a wider gate, seasons
- **Iron armour:** armoured soldiers have **+30% health**, both in raids and in battles.
  - Spearmen (3 iron), archers (2), ninja (2) and sōhei (3) are fitted with armour when they graduate, if you have the iron. Without iron they train unarmoured, and you get a warning.
  - Shield-bearers, samurai, cavalry and commanders always come in armour.
  - The **Blacksmith's Armoury** fits armour to every soldier who has none.
  - The Dojo and Kyūdō Range show the armour cost. A soldier's panel shows whether they wear armour.
- **More uses for iron:**
  - Battering rams (10 iron) and catapults (25 iron).
  - Military and defence upgrades to level 3 and above.
  - Keep level 4 (80 iron) and level 5 (200 iron).
- **Quests** have their own button on the top bar, with a scroll icon. It shows "N to claim!" when a reward is waiting.
- **Wisdom** is a counter next to the resources, with a new brush-and-ink-stone icon.
  - Research is opened **only at the Scholars' Pavilion**. Clicking the Wisdom counter takes you there.
- **The Castle Gate is 3 cells wide.** It has guard walls on both sides and a road running under the middle. Gates from older saves stay 2 wide until you move them.
- **Seasons:** a season now lasts 2 days (24 minutes) instead of 3. Days (and so seasons) also advance while you are away; before, the time away never counted as days.

## Town Square, sleeping at night, distinct mines
- **Town Square** (Harmony tab, one per village):
  - Stone paving, a festival tower (yagura) with a taiko drum, strings of lanterns, benches and a stall.
  - Villagers can walk across it and relax there.
- **Festivals are held in the evening, after work.**
  - A festival you hold starts at about 15:30 that day, or the next day if it's already late.
  - With a Town Square, the villagers dance the **Bon Odori** in a circle round the yagura, with a few sharing sake at the edge. The mood lift is +25 instead of +15.
- **Night:**
  - Most villagers go to bed. About one in four keep working the night shift, always the same ones.
  - About a third of the soldiers stay on watch and patrol, and the rest sleep. Raids wake everyone.
  - The night now passes in a quarter of the day (3 of the 12 minutes), so there's less waiting in the dark.
- **Mines:**
  - The gold mine has warm sandstone with glinting gold veins, a washing sluice with a pan, and a strongbox of nuggets.
  - The iron mine has dark rock with rust-red ore streaks, charcoal heaps, a bellows shed and a furnace with a glowing chimney.

## PC site / mobile site
- In the **Menu → Site**, choose **Auto** (follows your screen, as before), **PC site** or **Mobile site**, like a browser's "request desktop site".
  - **PC site:** the full desktop layout even on a small screen or a tablet. On a phone the page is laid out 1280 wide and shrunk to fit.
  - **Mobile site:** the compact touch layout with bigger buttons and no keyboard hints, even on a big screen.
- The choice is remembered on the device.

## First person — preview (milestones M0 + M1 of plans/first-person-battles.md)
- **Open it** from **Menu → ⚔ First person (preview)**, or add `?fp=sandbox` to the address. **Back to the village** is in its pause screen. The village waits while you're away.
- **The valley:**
  - A river winds through it, with carved banks, gravel edges, reeds and two shallow **fords** with stepping stones (slow to wade).
  - Deep water can't be crossed. An arched **plank bridge** with rails crosses the river.
  - Hills, mountains, forests, rocks and grass.
- **The training yard:**
  - Sand floor, bamboo fence, and the village's own dojo, house and storehouse.
  - **Three straw dummies** to cut. They wobble, shed straw, and fall when cut down.
  - A **weapon rack** (F): yari or katana.
  - A **sparring post** that strikes back from your left, right or overhead, after a red glow. The orange glow means a heavy strike.
- **Fighting:**
  - Strikes come from three sides. Hold for a heavy strike.
  - Blocks must be on the matching side. A parry (block at the last moment) staggers the opponent, and your next strike does ×2.
  - Stamina: running, strikes, dodges and blocked hits cost it; at zero your guard breaks.
  - Heavy strikes break a guard.
  - Also kick (E), dodge (Space), feint (block during your wind-up), and hit zones (head ×1.6, body, legs ×0.7).
- **Controls:** keyboard + mouse, keyboard + trackpad, or keyboard + touchscreen.
  - Mouse and trackpad: the strike side comes from the direction you moved just before clicking; the right button (or a two-finger click) blocks.
  - Touchscreen: STRIKE (tap, or swipe ← ↑ →), BLOCK (hold, slide to turn), KICK, DODGE, USE, plus a move stick until you use W A S D.
  - Keyboard backups: J / I / L strike, K blocks.
  - Keys use their physical position, so QWERTZ keyboards work.
- **Settings in the pause screen:** weapon, sparring difficulty, time of day, look speed (mouse and touch separately), field of view, invert, auto-guard (recommended for trackpad and touch), the red strike cue, head bob, sounds.

### First person — new fighting controls, and every soldier in the training yard
- **Striking:**
  - **Click:** cuts alternate as a combo, left, right, left… An arrow beside the crosshair shows the side of the next cut.
  - **Hold the click:** a **heavy overhead** (the ring fills orange). It breaks any block or shield.
- **Blocking:**
  - **Hold the right button** (or a two-finger click, K, or the BLOCK button). Every strike from **in front of you** is stopped, whatever side it comes from, so just face your opponent. A shield covers a wider arc.
  - A block opens a calm **counter**: your next strike within a second does ×1.5 (gold ring).
  - The split-second parry is shelved. It's still in the game as an experimental setting, off by default.
- **Bows:** hold the right button to **aim**. The view zooms in and the circle closes as you draw. **Click** to loose. A click without aiming is a quick, less accurate shot.
- **Fight as any soldier** from the pause screen, or **F** at the armoury by the gate:
  - Ashigaru (yari)
  - Shield-bearer (sword and shield)
  - Archer (yumi, 24 arrows)
  - Samurai (katana)
  - Ninja (ninjatō; G throws a kunai)
  - Sōhei (naginata sweeps that cut two at once; G: a healing prayer)
  - Cavalry (on horseback with a lance; the faster you ride, the harder it hits)
  - Berserker (kanabō; G: a war roar that makes the next heavy strike hit all around)
  - Taishō (katana and war fan; G: a rally with full stamina and +25% damage)
- **The training yard also has:**
  - An archery range: three mato targets scoring 10, 7, 5 and 2 points, and a line of stones to shoot from.
  - An armoury by the gate: change soldier, or refill arrows and kunai.
- **The red ring** means a strike is coming, so block. **Orange** means a heavy one that breaks blocks, so dodge (Space).
- **Bow (kyūdō):**
  - Holding the aim button **raises** the bow (uchiokoshi), then **draws** it down and apart until the string hand rests by your cheek (kai). The limbs bend as you draw.
  - On release the **bow spins in the hand** (yugaeri) and the **hand flies back** (zanshin), then you nock the next arrow.
  - Holding full draw for long makes your aim tremble.
- **Weapons up close:** smooth, rounded shading, polished steel blades, curved katana and naginata blades, wrapped grips and round guards.
- **Taishō:** the war fan is gone; he fights with the katana in both hands.
- **Clicking fixed:**
  - A click made while a cut was still finishing could turn into a slow heavy strike. Now a quick click stays a quick cut.
  - If the browser refuses to capture the mouse, clicks now strike anyway (look around by dragging) instead of being swallowed.

### First person — real opponents (M2 of plans/combat-and-command.md)
- **Enemies fight by your rules.** They use the same combos, heavy overheads, blocks, counters, stamina and kicks as you. A small brain decides:
  - It **blocks** your wind-up after its reaction time: 0.24 s on Easy, 0.15 s on Normal, 0.09 s on Hard. It sometimes misses, less often on Hard.
  - It **counters** at once after a successful block.
  - It **breaks your block** with a heavy overhead or a kick if you hold it too long.
  - It **backs off** when out of breath, and **feints** on Normal and Hard.
- **Two at a time:** only two may attack you at once (one on Easy, three on Hard). The rest circle and wait their turn.
- **Sensei Kenji** in the training yard: **F** asks him for a **bout with wooden swords**. The bout ends when one of you has a fifth of your strength left, and the card keeps the score.
- **The bandit camp** across the bridge, at the end of the trail:
  - Tents, a campfire, stolen rice bales and a rough fence.
  - Three swordsmen by the fire and an archer on watch, who keeps 12–30 m away and aims where you're going.
  - They spot you at about 20 m (half that if you crouch), and one raises the alarm for all.
  - Fallen bandits drop with a splash of ink. **Pause → Reset the bandits** to fight them again.
- **On screen:**
  - The name and health of the one you're fighting, at the top.
  - The red or orange ring when anyone in reach winds up at you.
  - **Red ink at the screen's edge** when you're struck from outside your view, by a blade or an arrow.
  - A shield raised toward an archer catches his arrows.
- **Feel over words:**
  - Fights no longer show text like "Guard broken!".
  - **Blocks** throw sparks where the blades meet, with a clang and a jolt.
  - A **broken guard** bursts in a bigger shower of sparks, with a heavy crack and the camera knocked back.
  - **Kicks, hits and arrows** jolt the camera; a dodge whooshes.
  - Being out of breath gives a heavy breath, and an empty quiver makes the count flash.
- **No health bars for now:**
  - The enemy's name and health bar are gone, and so is your own health stroke. Your stamina stroke stays.
  - Being badly hurt shows as red ink that stays and pulses at the screen's edges, with a pounding heartbeat.
- **The bow, Zelda-style:**
  - A creak swells as you draw, and a bright ping sounds at full draw while the crosshair glows.
  - Releasing gives a twang and a small kick. The arrow flies with a white streak, lands with a wooden thunk and quivers where it sticks.
  - A bullseye plays a rising chime, throws a few sparks and makes the target jump.
- **The bandit camp** now sits in its own levelled clearing at the end of the trail, well inside the valley, with no trees or rocks in it.
