# Tenka — the world on foot

### The whole game becomes first person; the Keep is where you rule

*Status: **W0 and W1 built on 20 October 2026** (the `/v5/` backup; walking the village as the lord, the Keep door to the desk, the `/gfx/` detail with distance detail). Next: W2. Decisions made on 19 October 2026 (§7). Written 18 October 2026. Read it with `first-person-battles.md` and `combat-and-command.md`; this plan changes where those happen.*

---

## 0. The idea in one paragraph

You no longer look down on your village from the sky: you **live in it**. You start each session standing at the gate of your Keep, in first person, in the real village you built. Farmers in the fields, smoke from the forge, Kenji drilling recruits at the Dojo. You walk through it, talk to people, spar, shoot at the range, climb a tower, and fight raiders yourself when they come. When you want to rule, you **walk into the Keep**. Inside, at the lord's desk, the game becomes what it is today: the top-down village view with the build menu, research, quests, diplomacy and the map. Step out of the Keep again and you're back on your feet, in the village you just changed.

---

## 1. A session, as you'd play it

1. **You load the game** and stand at the Keep's gate in the morning light. The village is going about its day.
2. **You walk down the road.** A farmer bows as you pass. At the Dojo, two trainees spar. Kenji looks up: "Care for a bout, my lord?"
3. **A drum sounds from the watchtower:** bandits in the east. Your soldiers run to the wall. You climb the gate tower, take a bow from the rack and shoot from above, then go down and hold the gate with your spearmen.
4. **After the raid** you walk into the Keep. The view lifts into the top-down lord's desk. You place a new tower where the raiders broke through, start research at the Pavilion's scroll, claim the quest reward, and send scouts on the map.
5. **You step out** onto the steps of the Keep. The scaffolding for the new tower is already up. You walk over and watch the builders.

---

## 2. What stays, what changes, what goes

| Part | Today | After the shift |
|---|---|---|
| **The village** | Seen from above; you build it | **The same village**, but you walk in it. Building happens at the lord's desk in the Keep |
| **Building, upgrades, jobs** | Click buildings in the top-down view | **Only at the desk**, exactly as today. Nothing is built or placed on foot |
| **Research, quests, diplomacy, War Room** | Menus | At the desk. Later also **in person** at the right place (Pavilion, notice board, map table, Strategy Hall) |
| **First-person valley** (`js/fp/terrain.js`) | A separate valley far away | **Folded into the real village and the country.** The training yard becomes your Dojo and Kyūdō Range; the bandit camp becomes a place on the map |
| **Raids on the village** (`raids.js`) | Top-down defence with clicks | **You defend in person**, with your soldiers fighting by the same rules as you |
| **Battles abroad** (`battle.js`) | Top-down RTS | **First person** at the place itself (the plan already says this: M4–M9) |
| **The country map** | A view you switch to | **At the desk in the Keep** (and later, riding there yourself) |
| **Time** | Runs while you build; paused in the first-person sandbox | **Runs all the time, always at normal speed on foot.** The speed buttons work only at the desk |
| **Saves** | The village | The village **plus the lord: where he stands, his weapon and gear, his wounds** |

**What goes in the end:**
- the separate training valley
- `battle.js` (the old RTS battles)
- the top-down raid controls in `raids.js` (its raid planning stays)

---

## 3. The big shifts, one by one

### 3.1 One world instead of two

- **Today:** the village lives at the scene origin (`js/render/nature.js`, a 144 × 144 m plot with hills around it), and first person lives in its own valley 4 km away.
- **After the shift:** first person happens **in the village itself.** You walk on the village terrain (`heightAt`), between the real buildings and villagers.
- **What the village needs for this:**
  - **Collisions:** every building already fills grid cells (`game.grid`), so their footprints become solid boxes. Walls are solid; **gates, roads and the town square are walkable.** Trees, rocks and fences become small solid circles, like in the valley.
  - **Height:** the plot is flat and the hills rise around it. You can walk up into the near hills, as far as the plot edge plus a margin, then gentle "too steep" slopes stop you.
  - **Water:** the lake to the south-east. Later the meandering **river** from the valley could run through the village land.
- **Kept from the valley:** the terrain code can still make the **battlefields abroad** (M4: real places with rivers).

### 3.2 Two ways to see the same world

| | On foot (the default) | At the lord's desk (inside the Keep) |
|---|---|---|
| **How you get there** | Start of the game; step out of the Keep | Walk up the Keep's steps and through its door |
| **Camera** | Your eyes, 1.6 m up | Today's top-down camera |
| **What you can do** | Walk, run, talk, fight, use things (F), train. **No building** | Everything you do today: build, move, upgrade, jobs, research, quests, diplomacy, map, War Room |
| **Screen** | The first-person look: crosshair, stamina, no health bar, no combat texts | Today's interface (the ink-and-lacquer look) |
| **Time** | Runs, **always at normal speed** | Runs; you can pause and change speed here, as today. Stepping outside sets it back to normal speed |

- **The transition:** walking into the door fades through ink to the desk view, which starts over the Keep. Leaving the desk (a "Step outside" seal, or **Esc**) fades back, and you stand on the Keep's steps facing the village.
- **No shortcut (decided):** the desk opens **only** through the Keep's door. Things that need you reach you on foot instead:
  - the drum of a raid
  - a messenger running up with news from the map
  - the ink compass pointing home
  - the Esc menu, which pauses, but never opens the desk
- **That makes the Keep the heart of the village.** It stands in the middle, so you're never far from it: at most about 70 m, or 12 seconds' run.

### 3.3 The village up close

Seen from 1.6 m instead of 60 m, the village has to hold up to a close look.

- **Detail:** this is what the **detail preview** (`/gfx/`) already does: ribbed roofs, post footings, shoji grids, detailed trees, faces. It becomes part of the main game, with distance detail (full detail near you, simpler far away) to keep the iPad smooth.
- **Doors and interiors:** today every building is a closed block. Step by step:
  1. **Doors you can see:** each building gets a clear door on its front side (the models already face +z).
  2. **Entrances you can use:** walking into a door opens what's inside as a menu or scene. The Keep goes to the lord's desk, the Pavilion to the research scroll, and so on (§3.4).
  3. **A few real interiors** later, where it's worth it: the Keep's audience hall, the Dojo floor, the teahouse.
- **Villagers who notice you:**
  - They step around you instead of walking through you, and bow when you pass.
  - Speech bubbles turn toward you, and F talks to someone (their name, job, mood, a line of their own).
  - Today's villager brain (`villagers.js`) stays. It needs avoidance of the player and a "the lord is here" reaction.
- **Animations close up:** walking, working, carrying, sitting and dancing all exist. Seen from close, they need smoother blending, and feet that don't slide.
- **Scale check:** a house is 4 × 4 m, the Keep 8 × 8 m and 12 m tall, a villager about 1.9 m. These proportions already work at eye height.

### 3.4 Places you can walk into: the menus become places

Each menu you use today gets a **place in the village** where it happens. The desk keeps all of them too, so nothing gets harder.

| In the village | What happens there on foot |
|---|---|
| **The Keep** | The lord's desk, **the only way in**: build, upgrade, jobs, quests, diplomacy, the country map |
| **Scholars' Pavilion** | The research scroll (it's already "research only at the Pavilion") |
| **Strategy Hall** | The War Room: your generals' skill trees (also at the desk) |
| **Dojo** | Sparring with Kenji, watching trainees, choosing what the Dojo trains |
| **Kyūdō Range** | The archery targets from the training yard |
| **Blacksmith** | **The lord's armoury:** pick the weapon you carry, better armour as iron and research allow, iron armour for your soldiers |
| **Market** | Trade face to face with the merchant (the offers today, as a stall) |
| **Shrine** | Pray: a small blessing, and quiet music |
| **Town Square** | The festival: join the Bon Odori in the evening |
| **A notice board** (new, by the Keep) | Quests and side tasks, pinned as paper slips. Claim the rewards here |
| **Stables** | Take a horse: ride through the village and out into the country |
| **Gate towers, walls** | Climb up, look out, shoot during raids |

### 3.5 Defending the village in person

- **Raids already exist** (`raids.js`): raiders come from the hills, bring ladders and rams, and break through gates and walls.
- **What changes:** they become **actors** (`js/fp/actors.js`) who fight by your rules.
- **Your soldiers become actors too:** spearmen hold the gate, archers man the towers. Your **squads** follow your orders (`combat-and-command.md`: Z follow, X hold, V charge, Tab tactical view).
- **The warning:** the drum on the watchtower, a red glow on the horizon at night, and edge markers.
- **After the raid:** the wounded walk to the healer, and the dead are mourned. All of this already exists in the village systems.

### 3.6 Going to war

- **The country map** stays the way to choose where to go: **at the desk in the Keep.**
- **Sending an army:**
  1. **You, the lord, lead it.** You pick your squads and generals at the **muster**.
  2. The march happens on the map.
  3. On arrival you're **there in first person:** a real village, fort or castle, built from your own village's models, with rivers and fields (M4–M6 of the battle plan).
- **Later:** you **ride out yourself** from the Stables across the country, a real journey, with ambushes on the road.

### 3.7 Who you are — the lord (decided)

You are **the daimyō, the lord of the clan**: one character, always you, in the village and in every battle.

- **The look:** a model of his own. Clan colours, a crested kabuto, armour that grows richer as you rise.
- **Weapons:** the lord chooses **which weapon he carries** at his armoury (the Blacksmith). The soldier classes from the training yard become his weapon choices:
  - katana
  - yari
  - yumi
  - naginata
  - kanabō
  - sword and shield
  - riding with a lance from the Stables

  New weapons open with research and the Blacksmith's level. The ninja's tools (kunai, the quiet crouch) can come as a skill later.
- **Growing stronger:** the lord's **rank** rises with battles and kills, as soldiers' ranks do today, and gives a little more health and stamina. **Iron armour** from the Blacksmith adds the +30%.
- **When the lord falls:** he is **carried home wounded**, never killed. He wakes at the Keep and is slower and weaker for a few days until the healer has done her work.
  - In a battle abroad, the lord falling hits your men's morale hard. The battle is likely lost unless a general rallies them.
  - The "take over another soldier" idea from the battle plan is dropped.
- **Your commanders become your generals.** The Berserker and the Taishō fight **beside** you as strong allies (actors), with the skills you bought them in the War Room. You never play them yourself.
- **Saved with the village:** where the lord stands, his weapon, gear, rank and wounds.

### 3.8 Controls and screen

- **On foot:** exactly the first-person controls you already have:
  - W A S D, Shift, C, Space, F use, E kick, G ability, J/K, Esc
  - click = combo, hold = heavy, right = block, bows aim with right
  - squads later on 1–4 / Z X V B / Q / T / Tab
  - mouse, trackpad and touchscreen all work as today
- **At the desk:** today's controls and interface.
- **On-foot screen:**
  - The crosshair and stamina stroke, as now.
  - A small **ink compass** at the top, with the Keep, the gates and anything that needs you (a raid, a reward waiting).
  - Resources and messages only as a quiet line of ink.
  - **No health bars, no combat texts.**

### 3.9 Saves and time

- **Saved on top of the village:** the lord (where he stands and looks, his weapon, gear, rank, wounds) and the squads you've formed.
- **Time:** the village keeps living while you walk, **always at normal speed on foot.** At night most people sleep, as now, and the short night still applies. Only the desk has pause and the fast speeds.
- **Coming back after being away** works as today ("While you were away…").

### 3.10 The code: what changes where

| File | Change |
|---|---|
| `js/main.js` | Starts **on foot**. The loop runs the first-person mode over the village scene instead of the far valley, and the switch to the desk is a mode change |
| `js/fp/fpmode.js` | Works in **any world**: the village (default) or a battlefield abroad. The training yard and bandit camp move out of it |
| `js/fp/controller.js` | Ground height from `heightAt` in the village. Solid boxes from the building grid, open gates, walkable roads and squares, stairs and towers |
| `js/fp/actors.js` | Villagers and soldiers can be actors when a fight starts; raiders become actors |
| `js/game/villagers.js` | Step around the player, bow, talk. Soldiers hand over to the actor brain in a raid |
| `js/game/raids.js` | The raid planning stays; the fighting goes to the first-person actors |
| `js/game/battle.js` | Retired once battles abroad are first person (M9) |
| `js/render/buildings.js` | Doors on every building and a few interiors; the detail from `/gfx/` with distance detail |
| `js/render/people.js` | The detail from `/gfx/`, smoother animation close up |
| `js/ui/hud.js`, `views.js` | The desk is today's interface, opened from the Keep. "Step outside" returns you to your feet |
| `js/fp/hud-fp.js` | The compass, talk cards, use-prompts for every place in §3.4 |
| `js/fp/terrain.js`, `training.js` | Become the battlefield generator (M4) and the Dojo/Range in the village |

---

## 4. The opportunities this gives you

- **A village that's alive in front of you.** Everything you built (festivals, the night shift, the forge, smoke, seasons) you now *see and hear* up close instead of reading about it.
- **Meaning for every building.** A building is a place you go to: pray at the shrine, drink at the teahouse, train at the Dojo, shoot at the range, trade at the market. Beauty buildings become pleasant places to walk.
- **People with names.** Villagers you've had since the start become people you meet. Their moods, jobs and wounds are visible. The chronicle becomes their stories.
- **Raids become the best moments.** You hold the gate yourself, shoot from the tower, and see the wall you built stop them. Building and fighting finally feed each other.
- **Quests that guide you naturally.** The notice board, a villager's request, a messenger running up to you with news from the map.
- **Your own progression:**
  - your gear from the blacksmith
  - your rank from battles
  - your horse from the stables
  - later, your armour colours and banner
- **Travel and discovery:** ride out of your gate into the country to scout, trade with the market town, or reach a temple in the mountains.
- **Night and seasons:** lanterns lighting the roads, snow underfoot, the Bon Odori on summer evenings, cherry blossoms in spring, and night raids by torchlight.
- **A clear identity:** few games let you *rule* from above and *live* below in the same world. That's Tenka's hook.

---

## 5. Risks, and how to handle them

| Risk | How we handle it |
|---|---|
| **iPad speed:** the whole village up close plus people and fights | Distance detail (full detail only near you), fog hiding the far edge, fewer grass tufts far away, a quality setting. Keep the fps counter during development |
| **The village looks bare up close** | Bring in the `/gfx/` detail first, then doors, then props (barrels, laundry, tools by each workplace) |
| **People walking through you, or stuck** | Simple avoidance around the player; villagers wait or step aside. Keep their grid paths as they are |
| **Two control schemes confuse** | On foot is always first person, the desk is always today's game. The switch is always the Keep door, or one key |
| **Too big to do at once** | Phases (§6). Each one is playable and pushed. A backup (`/v5/`) before the first |
| **Old saves** | The village save stays as it is; the new player data is added. Old saves start on foot at the Keep |

---

## 6. Build order (each step playable)

| Step | What you get | Done when… |
|---|---|---|
| **W0** | **Backup `/v5/`** of today's game | It plays with its own save |
| **W1** | **Walk your village, in detail.** You start on foot as the lord at the Keep, walk among the real buildings and people, and walk into the Keep for the desk. "Step outside" brings you back. Time runs at normal speed on foot. Collisions with buildings, walls, trees; gates and roads open. **The `/gfx/` detail comes in here**, with distance detail (full detail near you, simpler far away) | You can cross the village, enter the Keep, build something, step out and walk to it. It looks detailed up close and runs smoothly on the iPad |
| **W2** | **Places to use (part 1):** the Dojo (Kenji and the dummies move here), the Kyūdō Range (targets), the Pavilion (research), the Strategy Hall (War Room), a notice board (quests) | Every place opens its thing with F |
| **W3** | **Living people:** villagers step aside, bow to their lord, and talk (F). Soldiers patrol | A walk through the village feels alive |
| **W4** | **Defend in person:** raids fought on foot with your soldiers as actors; climb towers, hold the gate. Squads (M3 of the combat plan) | A raid can be won by fighting it yourself |
| **W5** | **Places to use (part 2):** the market, shrine, Town Square festival, the lord's armoury at the Blacksmith (weapons and armour), the Stables (ride a horse in the village) | |
| **W6** | **War abroad in first person:** muster → march → real enemy places (M4–M6) → aftermath. `battle.js` retired | Taking a bandit camp or a fort works end to end |
| **W7** | **Ride out:** travel the country on horseback, with roads, ambushes and arriving at places | |
| **later** | Interiors (the Keep's hall, the Dojo floor, the teahouse), named villagers' stories, the lord's banner and richer armour | |

---

## 7. Decisions (made 19 October 2026)

1. **Who you are on foot:** **the lord** (the daimyō), in the village and in battle (§3.7).
2. **The desk:** **only in the Keep** — since 21 Oct 2026 it's the lord's desk inside the Keep's hall (with his bed and armoury). No shortcut key or button.
3. **Building:** **only at the desk.** Nothing is placed on foot.
4. **Time on foot:** **always normal speed.** Pause and the fast speeds exist only at the desk.
5. **Detail:** **the `/gfx/` detail comes in from the start** (W1), with distance detail for the iPad.
6. ~~Don't start building yet~~ — the player said go on 20 October 2026.
