# Tenka — handover

*Everything important from the long build conversation, so work can go on anywhere (iPad, Claude Code on the web, another PC). Last updated: 27 September 2026.*

---

## 1. What Tenka is

- **Tenka (天下, "the realm")** is a Japanese samurai village builder in the browser.
- **The village:** you build houses, farms, lumber camps, quarries, mines, roads, walls and gates. Villagers live, work, sleep and celebrate.
- **Progress:** you research through eras, raise your Keep (levels 1–5), and train soldiers at a Dojo and a Kyūdō Range.
- **War:** you send armies across a country map, fight bandits and three rival clans, and aim to **unify the land**: take the Shogun's castle or break every clan.
- **The big project now:** a **first-person combat mode** (the "Blade & Banner" plan). You play one of your soldiers, fight with your own hands, and later command squads. It will replace the old top-down (RTS) battles.

**Links**
- The game: https://jolliusblecheimer.github.io/Game-3/
- First-person sandbox: https://jolliusblecheimer.github.io/Game-3/?fp=sandbox (also Menu → ⚔ First person (preview))
- Repo: https://github.com/jolliusblecheimer/Game-3 (branch `main`; GitHub Pages publishes `main` directly)

**Plans** (in `plans/`)
- `first-person-battles.md`: the big first-person plan. Controls for all three setups, weapons, squads, real enemy places, rivers, milestones M0–M11.
- `combat-and-command.md`: the detailed plan for fighting and commanding **after** the training yard. The next steps (M3 squads…) are here.
- `tenka-2-age-of-steam.md`: an idea for a steampunk sequel. Nothing built.

---

## 2. The player and how to work with them

- **Device:** mostly an **iPad**. Sometimes touch only, sometimes a keyboard (Magic Keyboard / trackpad) or a mouse. They use a **German keyboard (QWERTZ)**, so first person reads keys by physical position (`e.code`).
- **Messages:** short, often with typos ("reascherch", "vault it" = shelve it, "cooked" = broken). Read them generously, and if something is truly unclear, ask *one* short question.
- **Replies:** short and in plain English. Say what changed, what you tested, and that it's live. Offer the next step.
- **They like:**
  - Detailed **plans** as `.md` files in `plans/`.
  - **Backups** before big changes.
  - Real-world detail (kyūdō archery, Japanese buildings).
  - Satisfying feedback in the style of Zelda: sound, sparks and motion rather than text.
- **Releases:** they test on the live site. Every push goes live; the in-game banner "A new version is ready" appears within about 3 minutes.

---

## 3. Running, testing, releasing

### Local

```
python -m http.server 8777        # from the repo root
open http://localhost:8777/       # the village
open http://localhost:8777/?fp=sandbox   # first person
```

- No build step. `index.html` has an import map `three → ./lib/three.module.min.js`.
- `tools/launch.json` is the preview config for Claude Code desktop (copy it to `.claude/launch.json`).

### Debug handles (browser console)

- **`window.tenka`** = `{ game, stage, cam, input, hud, views, fp, save, advance, hooks, music }`.
  - `game.place(type, cx, cz, rot, {done:true, free:true})`, `game.canPlace`, `game.upgradeInfo(b)`, `game.graduate(v, job)`, `game.hasResearch(id)`, `game.state` …
- **`window.tenkaFP`** is the first-person mode (`FPMode`):
  - `fp.setClass('archer')`, `fp.player` (x, z, yaw, pitch), `fp.fighter` (the `Fighter`), `fp.actors`, `fp.sensei`, `fp.camp`, `fp.yard`, `fp.T` (terrain), `fp.update(dt)`.
- **Testing trick:** the preview pane runs at only about 4 fps. Stop the loop with `tenkaView.update = () => {}` and step the game yourself with `fp.update(1/30)` in a loop, so you can test fights exactly. Reload to undo.
- **Reloading changed files in the preview:** `fetch(file, {cache:'reload'})` for each changed file, then `location.reload()`.

### Releasing (important)

1. **Stamp** `version.json` before every commit: `python tools/stamp.py`, or install the hook once with `sh tools/install-hooks.sh`. It writes a new version id and the list of all js/css files.
   - `index.html` compares that id with the one the browser saw last and re-downloads everything once.
   - `main.js` checks every 3 minutes (and when the tab comes back) and shows the update banner.
   - **Without the stamp, iPads keep the old files.**
2. Commit, ending the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
3. `git push` to `main`. GitHub Pages is live about a minute later.
4. Add a short README section describing the feature in plain English.

### Backups (playable old versions, each with its own save)

| Folder | What it is |
|---|---|
| `/v1/` | the classic game, before the big "v2" update |
| `/v2/` | before the first-person project began (village features up to the Town Square era) |
| `/v3/` | right before the first-person plan |
| `/v4/` | the first-person training yard **before real opponents** (M0–M1, all classes, the kyūdō bow) |

- **How a backup is made:** copy `css/ js/ lib/ index.html version.json README.md` into `vN/`, then change inside the copy:
  - the save key → `tenka.vN.save`
  - the backup key, the version keys in `index.html`, the `tenka.fp` settings key
  - remove the service worker and manifest lines
  - its Menu text
- In the main game, add a one-time snapshot line in `js/main.js` (`tenka.vNsnapshot`) and a Menu link.
- The script used is in the chat history (`make_v4.py` pattern). Look at `v4/js/main.js` and `v4/index.html` to see the result.

---

## 4. Architecture (file map)

```
index.html            loader + updater (version.json), import map, loading screen
js/main.js            boot: Stage, Nature, Game, Hud, Input, Views, FPMode; the main loop; saving; update checks
js/util.js            h() DOM helper, noise, mulberry32, clamp/lerp/smoothstep, fmt
js/game/
  data.js             ALL the numbers: resources, JOBS, BUILDINGS, TOWNHALL, TECHS/ERAS, UNITS, CLANS, SITES,
                      DOJO_TRAINS (research + dojo level), ARMOUR, SEASONS, DIFFICULTY, COMMAND_TREES, RANKS …
  world.js            class Game: grid, buildings, villagers, economy, research, wonders, commanders, saving/loading + migrations
  villagers.js        what every villager does (work, carry, sleep at night with a night shift, festivals, soldiers patrol)
  life.js             seasons, weather, mood, festivals (evening, Town Square), merchants, events
  progress.js         QUESTS (21-step main line, claimable) + side tasks + achievements + chronicle
  country.js          the country map: places, scouting, armies, holds, trade routes, deals of the day
  clans.js            the three rival clans and diplomacy
  raids.js            village defence (raiders attack your village; soldiers defend) — top-down, still in use
  battle.js           the OLD top-down battles on the map (RTS) — still in use until first person replaces it (M9)
js/render/
  stage.js            renderer, sky, day–night, sun/moon, fog, water plane, particles
  nature.js           village terrain, trees (treeGeometry), grass, seasons
  geo.js              Mesher/ModelBuilder (vertex-coloured merged meshes), MAT.flat/glow/water/smooth/steel
  buildings.js        every building model (procedural), incl. wonders, town square, gate (3 wide), mines
  people.js           Person: the low-poly villager/soldier model with LOOKS and animate(pose)
  countrymap.js       the country map scene
js/ui/
  hud.js              top bar, panels, menu (incl. Site: Auto/PC/Mobile, first-person button), research scroll, quests
  views.js            switches village ↔ map ↔ battle; map UI; diplomacy; building extra panels
  input.js, camera.js the village camera and input
js/fp/                FIRST PERSON (see §6)
  fpmode.js           the mode: enter/exit, the loop, strikes, arrows, abilities, bouts, the camp, HUD info
  combat.js           Fighter — the shared melee rules (combo, heavy, block, counter, stamina, bows) + WEAPONS
  classes.js          the playable soldiers (CLASSES) and abilities
  controller.js       the player's body: walking, running, crouch, dodge, slopes, fords, bridge, collisions; pushOut()
  input-fp.js         keyboard (e.code), mouse/trackpad with pointer lock, touchscreen buttons + stick
  viewmodel.js        hands and weapons in front of the camera; the kyūdō bow rig; the horse's neck
  actors.js           AI people (Actor + brain), SKILL by difficulty, Sensei Kenji, the bandit camp
  terrain.js          the valley: meandering river (fords, bridge), heights, yard + camp clearings, trees/rocks/reeds/grass
  training.js         the training yard: straw dummies, sparring post, archery targets, armoury; Chaff particles
  projectiles.js      arrows/kunai (streak, stick, quiver)
  effects.js          Sparks (blocks, broken guards, bullseyes) + flashes
  hud-fp.js           crosshair, stamina, card, messages, edge warnings, pause/settings screen, soldier chooser
  sfx-fp.js           all first-person sounds (synthesised WebAudio), incl. the bow's draw creak
css/style.css         all styles (first-person styles at the end, prefixed fp-)
css/theme.css         THE LOOK (ink, washi, lacquer, vermilion seals, Japanese fonts) layered over style.css — restyle here
tools/stamp.py        writes version.json · tools/pre-commit + install-hooks.sh · tools/icons.py
v1/ … v4/             playable backups
```

**Conventions**
- **Models:** procedural models only. `b.m` is the normal mesh and `b.g` the glowing one (windows and lanterns glow at night). Front faces +z.
- **Comments:** short, plain English, and saying *why*.
- **Player-facing words:** British spelling (armour, colour), and Japanese names with macrons (Kyūdō, Sōhei, Taishō, Daimyō).
- **Numbers:** tuning numbers live in `data.js` (village) or at the top of `combat.js`, `actors.js` and `classes.js` (first person).
- **Settings storage:**
  - Village UI settings: `localStorage['tenka.ui']`.
  - First-person settings: `localStorage['tenka.fp']`.
  - Game save: `localStorage['tenka.save.v1']`.

---

## 5. The village game — what exists (summary)

- **Economy:**
  - Gatherers per job: farmer 6 wheat per 12 s, woodcutter 7 per 10 s, stonecutter 8 per 12 s, miner 6 gold per 14 s, iron miner 5 per 14 s. These were rebalanced because wheat used to be far faster.
  - Storage cap, markets, merchants. A merchant offer is **replaced** by a new one when taken. Market towns with a trade route have a changing **Deal of the day**.
- **Roads:** every working building must connect to the Keep by road (through gates too). A red 道 sign means no road. The Castle Gate is **3 cells wide**, with the road running under it; old 2-wide gates stay 2 wide until moved.
- **Research:**
  - Wisdom is a top-bar counter with an ink-brush icon. **Research opens only at the Scholars' Pavilion.**
  - One scroll per era, with a tree of medallions and golden lines. Key techs gate Keep levels. The Imperial Mandate is needed for the Shogun.
- **Troops:**
  - The Dojo trains classes that need **research and a big enough Dojo**: shield-bearer Dojo 2, ninja/sōhei/cavalry Dojo 3, samurai Dojo 4.
  - The Kyūdō Range trains archers. Dojo and Range levels drill all soldiers of their kind.
- **Commanders:** the Strategy Hall (Keep 4) is the **War Room**. The Berserker and Taishō each have a 3-tier skill tree bought with command points earned in battle.
- **Iron:**
  - **Iron armour** gives +30% health. Spearmen, archers, ninja and sōhei are fitted when they graduate if there's iron; the Blacksmith's Armoury fits the rest.
  - Iron is also needed for rams and catapults, military and defence upgrades from level 3, and Keep 4/5.
- **Quests:** a 21-step main quest line that guides you, plus side tasks. You **Claim** the rewards (Quests button with a scroll icon in the top bar). The old auto-pay is gone.
- **Diplomacy:** redesigned. Tabs per clan, what the status means, the road from war to marriage, a feelings bar, the best next step, and actions with reasons.
- **Life:**
  - **Seasons:** 2 days each; days also advance while you're away.
  - **Night:** shorter than the day (a quarter of the cycle). Most villagers sleep and about 1 in 4 work a night shift. About a third of the soldiers keep watch and the rest sleep.
  - **Festivals:** held **in the evening after work**. With a **Town Square**, villagers dance the Bon Odori round the yagura, and festivals lift the mood more.
- **Looks:** ground textures on military buildings and the quarry, distinct gold and iron mines, 9 Great Buildings (wonders).
- **Site setting (Menu):** Auto / PC site / Mobile site, like a browser's "request desktop site".
- **Old battles:** map battles are still the top-down RTS in `battle.js`, and village raid defence is `raids.js`. Both are to be replaced by first person later.

---

## 6. First person — where it stands

Opened from **Menu → ⚔ First person (preview)** or `?fp=sandbox`. While you're there the village is paused; "Back to the village" is on the pause screen.

### The world

- **The valley:** 380 m of terrain, playable to ±118 m, with mountains around.
  - **The river meanders.** Its heading drifts with noise and stays within about 70° of +z, so the river always flows toward +z, a fact the distance field relies on. It is Chaikin-smoothed and varies from 8 to 12 m wide.
  - **River features:** carved banks, gravel edges, reeds, 2 **fords** with stepping stones (slow to wade), deep water you can't wade, and an arched **plank bridge** with rails.
- **The training yard:** a levelled sand ring with a bamboo fence and an opening toward the bridge. The village's dojo, house and storehouse stand behind it. It holds:
  - 3 **straw dummies**
  - a **sparring post** that strikes back after a red glow (orange = heavy)
  - an **archery range** (3 mato targets scoring 10/7/5/2, and a stone shooting line)
  - an **armoury** by the gate (F: change soldier or refill arrows/kunai)
  - **Sensei Kenji** (F: a bout with wooden swords)
- **The bandit camp:** across the bridge, at the end of the trail, in its own levelled clearing (`T.camp`). Tents, a campfire, stolen rice and a stake fence; 3 swordsmen and an archer. Pause → "Reset the bandits".

### The fighting rules (the player's own design, keep them)

- **Click** = a cut; clicks **alternate left, right, left…** as a combo.
- **Hold the click** (0.3 s) = a **heavy overhead** that **breaks any block or shield**.
- **Hold right** (or two-finger click, K, the BLOCK button) = **block**. It stops every strike from **in front of you** (±~70°, wider with a shield), whatever side it comes from.
  - A successful block opens a **calm counter**: your next strike within 1 s does ×1.5.
- **The split-second parry is shelved**: an "Experimental" toggle in the pause screen, off by default (block at the moment of impact for ×2).
- **Stamina:** strikes, running, dodging and blocked hits cost it. At 0 your block breaks. It recovers after 0.7 s of rest.
- **Also:** E kick (breaks a block), Space dodge (brief invulnerability), C crouch, F use, G class ability, Shift run.
- **Hit zones:** head ×1.6, body ×1, legs ×0.7.
- **Bows:** hold right to **aim**. That's the kyūdō draw: raise, draw down to the cheek, 1 s to full; the view zooms and a ping sounds at full. **Click** to loose. A click without aiming is a quick, less accurate shot.
  - Arrows fly at 30 + 80 × draw m/s, with half gravity (a longbow: flat and accurate at full draw), spread 0.0012 at a full draw, and damage 10 + 38 × draw.
- **Weapons:** in `combat.js` WEAPONS (reach, cone, light/heavy wind-up, active, recovery, damage, stamina). Examples: katana light 25 dmg / 11 st; kanabō heavy 75 dmg.

### The soldiers (`classes.js`) — all playable in the yard

| Soldier | Weapon | Health | Stamina | Special |
|---|---|---|---|---|
| Ashigaru | yari | 100 | 100 | — |
| Shield-bearer | sword + shield | 115 | 100 | shield: wide block, stops arrows |
| Archer | yumi (24 arrows) | 85 | 100 | — |
| Samurai | katana | 120 | 100 | — |
| Ninja | ninjatō | 80 | 120 | G = kunai (4), faster, quiet crouch |
| Sōhei | naginata (hits 2) | 105 | 100 | G = prayer (+35 health) |
| Cavalry | lance on horseback | 120 | 100 | gallop (Shift): up to ×1.8 damage |
| Berserker | kanabō | 170 | 120 | G = war roar (the next heavy hits all around) |
| Taishō | katana (two hands) | 130 | 110 | G = rally (full stamina, +25% damage for 8 s) |

### The opponents (`actors.js`)

- They use the **same `Fighter`** as you. A brain thinks about 8 times a second:
  - **Block** your wind-up after a reaction time. Every new cut is judged again, so mashing doesn't work.
  - **Counter** after a block.
  - **Break your block** if you hold it long (heavy or kick).
  - **Back off** when tired, circle, and **feint** (Normal and Hard).
- **"Two at a time":** attack tokens mean only 1/2/3 enemies (Easy/Normal/Hard) may strike at once. The others circle further out.
- **SKILL by difficulty:**

  | | Reaction | Blocks missed | Feint chance | Damage | Tokens | Archer aim error |
  |---|---|---|---|---|---|---|
  | Easy | 0.24 s | 33% | 0% | ×0.7 | 1 | 0.05 |
  | Normal | 0.15 s | 17% | 12% | ×1.0 | 2 | 0.03 |
  | Hard | 0.09 s | 8% | 30% | ×1.25 | 3 | 0.018 |

- **Archers** keep 12–30 m away, aim where you'll be, and kick if you get close. A raised shield stops their arrows.
- **Spotting:** enemies see you at about 20 m (half if you crouch), and one raises the alarm for the whole group.

### Feedback (the player's wishes)

- **No health bars** (neither the enemy's nor yours). Low health shows as red ink at the screen edges that stays and pulses, plus a **heartbeat**. The stamina stroke stays.
- **No combat texts** ("Guard broken!" etc.). Instead:
  - sparks where blades meet
  - a big spark burst and a heavy crack for a broken guard
  - camera jolts and FOV kicks
  - a dodge whoosh and a breath sound when tired
  - red ink at the screen edge for hits from outside your view
  - an ink splash on hits; the fallen tip over
- **Kept on purpose:** a few story lines (soldier description, first tip, bouts, camp cleared).
- **The crosshair:**
  - an arrow at the side of the next cut
  - an orange ring filling for the heavy
  - blue = blocking, gold = counter ready
  - red / orange = a strike is coming (a setting can hide it)
  - for bows, the circle closes as you draw and glows at full draw
- **The bow, Zelda-style:** a creak swelling on the draw, a ping at full draw, a twang on release, an arrow streak, a wooden thunk, the stuck arrow quivers, and a rising chime + sparks + target jump for a bullseye.

### Controls on each setup

- **Keyboard (always the same):**
  - move and actions: W A S D, Shift, C, Space, E, F, G
  - J = strike (hold = heavy), K = block / aim
  - Esc = pause
  - The plan reserves 1–4 / Z X V B / Q / T / Tab for squads.
- **Mouse:** pointer lock. If the browser refuses it, clicks still strike and you look by dragging.
- **Trackpad:** click and two-finger click. Its own sensitivity.
- **Touchscreen:** drag to look. Buttons: STRIKE (tap / hold), BLOCK (AIM / SHIELD), KICK, DODGE, USE, and the ability. A move stick hides once W A S D are used.
- **The Site setting:** "Mobile site" starts with the touch buttons.

### Settings (pause screen, stored in `tenka.fp`)

Soldier, sparring difficulty (also the enemies'), time of day, "I play with" (mouse / trackpad / touch), look speeds, field of view, invert, the red warning cue, head bob, sounds, experimental parry.

---

## 7. Decisions — don't undo these without asking

1. First person **replaces** the old battles eventually. It must work on **keyboard + mouse / trackpad / touchscreen**.
2. **Strike choice:** click = alternating left/right combo, hold = guard-breaking heavy overhead, right = block (non-directional, face the strike), calm counter ×1.5. **The parry is shelved** (optional).
3. **No health bars**, **no combat texts**: feedback through effects and sound.
4. **The bow's look stays as it is now.** A version that held the bow further left and aligned the arrow to the crosshair was **rejected** ("it broke") and reverted. Arrow *flight* stays fast, flat and accurate (longbow).
5. The **Taishō's war fan was scrapped**. It may come back only as a visual command signal.
6. Research is **only** at the Scholars' Pavilion. Quests are **claimed**, with their own top-bar button.
7. **Make backups (`vN/`)** at milestones and before big changes.
8. **The interface should look Japanese and stay tidy** (the player's words: it shouldn't "scream AI" or fill the screen): washi paper, ink frames, lacquer with gold, vermilion seals, Shippori Mincho / Zen Kaku Gothic New (css/theme.css). The build menu and village scroll fold up and remember. No generic rounded web cards.

---

## 8. Open questions and loose ends

- **"The landscape of the ring is cooked":** we asked which ring (the bandit camp's stake fence was on a slope before and is now fixed, or the training yard's ring?). There's no answer yet. Check both if it comes up.
- **"The bow is in the way when aiming":** still open. The last try was rejected (see Decision 4). Any new attempt should be a small visual tweak, shown to the player first.
- **Health bar:** we read "no health bar at all" as yours too. If the player wants theirs back, just unhide `.fp-bars .fp-bar.hp` in the CSS.
- **Stamina per class:** we offered to spread it more (archer 80, shield-bearer 120, samurai 110). No answer yet.
- **Feel tuning:** reaction times, damage and the number of attackers are single numbers in `actors.js` (SKILL) and `combat.js` (WEAPONS).
- **Performance:** the valley is about 400k triangles (grass and trees trimmed). The iPad target is 60 fps. Watch it as squads are added.
- **Test gaps:** Kenji and the camp were tested with scripted fights, not by feel.

---

## 9. What's next (from `plans/combat-and-command.md`)

| Step | What | Done when… |
|---|---|---|
| **M3a** | **One squad:** 6 spearmen who follow you. **Z** Follow, **X** Hold (where you look), **V** Charge (what you look at). The line rotates tired men; morale rises and falls | You can lead them into the bandit camp and win |
| **M3b** | 4 squads, the **Q** order wheel, **Tab** tactical view (25% time, drag banners), formations: shield wall, spear hedge, loose, wedge; archer volleys; rallying | All three input setups work |
| **M4** | **Real enemy places:** villages, forts and castles generated from the village's own building models at their levels, with roads, fields, clan banners and civilians who hide | |
| **M5** | Meandering rivers on the country map too | |
| **M6** | Walls with walkways, ladders, rams, gates, towers, catapults | |
| **M8** | Commanders: War Room skills become first-person abilities | |
| **M9** | **Into the game:** map → muster (choose your hero and squads) → march → battle → aftermath (wounds, deaths, ranks, loot, Plunder / Hold). **Remove the old `battle.js`** | |
| later | Defend your own village in first person | |

**Squad controls already decided:**
- 1 2 3 4 select a squad (5 = all).
- Z follow · X hold · V charge · B cycle formation.
- Q (hold) opens the order wheel.
- T (hold) shouts (morale).
- Tab opens the tactical view.
- Touch: squad badges at the top and an ORDER button.

---

## 10. Continuing from the iPad

- **Claude Code on the web** (claude.ai/code, or the Claude app → Code) can open this repo from GitHub. Connect the GitHub account and choose `jolliusblecheimer/Game-3`. Claude reads `CLAUDE.md` automatically.
- **In a fresh cloud session:**
  1. Run `sh tools/install-hooks.sh`, or remember to run `python tools/stamp.py` before each commit.
  2. Test with a local server if the environment has a browser. If not, at least check the modules load (for example by running the game in a headless browser, or with careful review), then push and check the live site on the iPad.
- **Pushing to `main` publishes the game.** For experiments, work on a branch and merge when happy.
