# Tenka — *Blade & Banner* (刃と旗)
### A plan to replace the battle system with first-person battles in which you fight and command at once

*Status: M0 and M1 are built, and all soldier classes can be tried in the training yard (new controls: click = left/right combo, hold = heavy overhead, right = block facing the strike, bows aim with right); the split-second parry is shelved as an option. Built (Menu → ⚔ First person (preview), or `?fp=sandbox`); the rest is still plan. Backups of the game before this change: `/v1/`, `/v2/`, `/v3/`.*

---

## 0. The idea in one paragraph

You no longer watch battles from the sky. You **are** one of your soldiers: a spearman you trained, a shield-bearer, an archer, a ninja. When you get commanders, you can be your Berserker or your Taishō. You see the battle through their eyes. You fight with your own hands (block, parry, strike, draw the bow), and you shout orders to the men around you: "Follow me!", "Hold here!", "Shield wall!", "Loose!". The places you attack look like real places, built from the same houses, storehouses, fields, walls and keeps as your own village. Rivers wind through the valleys the way real rivers do. It should be hard. A spearman alone dies fast. A spearman who keeps his line together, uses the river ford and times his parries wins.

---

## 1. What stays, what goes

| Keep (it works, the new mode plugs into it) | Throw away (buggy or replaced) |
|---|---|
| The country map, scouting, marching, `sendArmy` / `returnArmy` | `js/game/battle.js` (1386 lines of RTS battle) — rewritten from scratch |
| The army picker (who comes along, rams, catapults), redesigned (§3) | The RTS battle camera, box-select, group keys 0–9, J/K/L squads, T/Y/X/G/R keys |
| Loot, Plunder / Hold, tribute, garrisons, clans, the Shogun win | The straight river strip with its fake flat water plane (`buildRiver`) |
| Ranks and XP (`credit`), wounds (`hpf`), iron armour, research bonuses, forge bonus | The "40 s without a blow → rout" timer, the O(n²) `separate`, the spike bug, the stuck-hold bug |
| Commander skill trees and command points: they become **your abilities** (§6.6) | Level-1-only enemy buildings; tiny generic enemy layouts |
| `Person` models and looks, `MODELS` from `buildings.js`, `Stage` sky, day/night and weather, `treeGeometry`, sounds | |
| Village raid defence (`raids.js`): unchanged in phase 1, first-person later (§12) | |

**Bugs found in the current battle code (these go away with the rewrite):**
- Spikes deal damage without ever killing, and resting units heal faster than the spikes hurt. Health can end up negative and be written back as a wound.
- A garrison defence interrupted by a reload leaves that hold stuck forever (`hold.attack.fighting` is never reset).
- Fleeing attackers in a defence never reach the map edge.
- Enemy walls are level 1, so the wall archers stand in mid-air.
- Per-frame allocations, and night point-lights that force shader recompiles.

---

## 2. A battle from start to finish

1. **Map → choose a place → "Raid".** As today.
2. **Muster** (a new screen, replacing the army picker):
   - Pick who comes, as today.
   - **Pick yourself:** a row of portraits of your soldiers with rank stars, armour, wounds and kills. Tap one: "You will fight as **Hayato**, Veteran spearman ★". Before you have commanders you can only pick a soldier. Once you have appointed commanders, they are at the top of the list.
   - **Squads:** your soldiers are sorted into up to **four squads** by class automatically (Spears, Shields, Bows, Specials). You can drag people between squads, and each squad gets a banner colour. Your own squad is the one you are in.
   - Rams and catapults, as today.
3. **March** as today.
4. **Arrival (deployment, about 20 s):**
   - The screen fades from ink to colour, and you are standing with your squad at the edge of the valley. The enemy place lies ahead: fields, houses and a palisade, or a stone castle on a hill.
   - A scroll unrolls at the top: "**Take the village of Kawabata.** The gate faces south. A ford crosses the river to the east."
   - You can walk around and look, and give your first orders.
   - Press **Enter** (or click / tap **Begin**) when ready. The horn sounds.
5. **The fight.** Real time with no pause, but with the tactical view (§6.4). The enemy has not seen you yet: you can sneak up, or storm in.
6. **The end:**
   - **Victory:** the enemy flees, surrenders, or you take their keep or banner. The camera rises slowly out of your hero's eyes into the sky: "Victory".
   - **Defeat:** your squads are broken. You can **sound the retreat** at any time: hold **Backspace**. Everyone runs for the valley edge, and whoever makes it out survives.
   - **Your hero falls:** see §3.2.
7. **Aftermath** (as today): losses, wounds, rank-ups, loot, then Plunder or Hold. Also new: a short **chronicle line** for your hero ("Hayato took the gate of Kawabata and felled 6").

---

## 3. Your hero

### 3.1 Who you can be

- **Before commanders:** any soldier you own: ashigaru (spear), shield-bearer, archer, samurai, ninja, sōhei, cavalry.
- **After commanders:** also your **Berserker** (Keep 4) and your **Taishō**, with their skill trees as abilities.
- **Choosing matters:**
  - A Hero-rank spearman with iron armour is much stronger than a fresh recruit.
  - Your hero's **rank gives you more health and stamina** (+10% per rank, as today).
  - **Wounds carry over:** a wounded hero starts with less health.

### 3.2 When your hero falls — "challenging, but not cruel"

- Health reaches 0 → you are **down**, not dead. The screen goes grey and ink bleeds in.
  - For 12 seconds a nearby friend can **drag you back** (the AI does this if a squad-mate is close and not fighting).
  - Or press **Space** to **take over another soldier** of your squad, who becomes your hero for the rest of the battle.
- If nobody is left to take over, you watch the rest from above: the tactical view, orders only.
- **After the battle:**
  - A downed hero who was not recovered **dies**, just like any soldier today (`killVillager`).
  - A recovered hero is **badly wounded** (health 20%) and must rest at the healer.
  - **Difficulty setting:** Easy = downed heroes are always recovered. Normal = as above. Hard = no taking over; when your hero dies, the battle is over for you (tactical view only).

---

## 4. Controls

**There are three ways to play, and every battle must be fully playable with each of them:**

| Setup | Left hand | Right hand |
|---|---|---|
| **A. Keyboard + mouse** | keyboard | mouse: look, strike, block |
| **B. Keyboard + trackpad** (e.g. iPad Magic Keyboard, laptop) | keyboard | trackpad: look, click to strike, two-finger click to block |
| **C. Keyboard + touchscreen** (e.g. iPad with a keyboard case) | keyboard | screen: drag to look, on-screen strike and block buttons |

- **The keyboard is always there and does the same thing in all three setups:** moving, dodging, orders, squads, abilities, the tactical view.
- **Only looking, striking and blocking** change with the pointing device.
- The game **detects the device on its own** from the pointer event type: mouse or trackpad give `pointerType 'mouse'`, a finger gives `'touch'`. The last used device wins, so you can switch mid-battle, e.g. from trackpad to touching the screen.
- The settings show which setup is active and let you tune it.
- **The Menu's Site setting** (Auto / PC site / Mobile site, already in the game) sets the starting point: **Mobile site** shows the touchscreen buttons from the start; **PC site** hides them until you touch the screen.

### 4.1 The keyboard (the same in all setups)

| Key | What it does |
|---|---|
| **W A S D** | Walk |
| **Shift** (hold) | Run (uses stamina) |
| **C** | Crouch / sneak (toggle). Quieter, harder to see; the ninja is much better at it |
| **Space** | Dodge-step in the direction you are moving (costs stamina). While down: take over another soldier |
| **F** | Use: open or close a door or gate, climb a ladder or tower, pick up arrows, pull a wounded friend, pick up a banner, finishing blow |
| **E** | Kick / shield-bash (pushes an enemy back, breaks their guard) |
| **R** | Archer: put the arrow back · ninja: throw a kunai |
| **G** | Special ability (§6.6), smoke bomb (ninja) or a stone (anyone, to distract). Hold G to choose between several |
| **Q** (hold) | **Order wheel** (§6.2): choose with the pointer or with W/A/S/D, release to give it |
| **1 2 3 4** | Select squad 1–4. **5** = all squads |
| **Z X V B** | Quick orders to the selected squad: **Z** Follow me · **X** Hold here (where you look) · **V** Charge (at what you look at) · **B** Form up (cycles line / shield wall / loose / wedge) |
| **T** (hold) | Shout ("Tenka!"): raises your squad's morale, and alerts nearby enemies |
| **Tab** | **Tactical view** (§6.4): time slows to 25%, the battle is shown from above |
| **H** (hold) | Bind your wounds: slowly restores a little health, can't move (3 bandages per battle) |
| **Backspace** (hold 2 s) | Sound the retreat |
| **M** | The objective scroll |
| **Esc** | Pause menu: settings, sensitivity, invert, field of view, retreat. Also releases the mouse |

**Keyboard backups for fighting** (so a trackpad or touchscreen never leaves you stuck):
- **J / I / L** = strike from the left / overhead / from the right. Hold for a heavy strike.
- **K** (hold) = block. The guard follows the last strike direction you pressed, or **auto-guard** (below).
- The right hand can rest near J, K, L and I while the left hand is on WASD. This is the most precise way to choose a strike direction on a trackpad.

### 4.2 Setup A — keyboard + mouse

- **Look:** move the mouse. The mouse is captured with **Pointer Lock**; Esc releases it.
- **Strike (left click):** the **direction the mouse was moving in just before the click** chooses the strike: from the left, from the right, or overhead (moving up). No movement means the last direction used.
- **Heavy strike:** hold the left button for about 0.4 s, then release.
- **Block (hold the right button):** the guard side follows the mouse direction while holding. **Tap** right at the moment of impact to **parry**.
- **Archer:** hold right to draw the bow, left to loose.
- **Mouse wheel:** switch squad (instead of 1–4). The middle button is the order wheel (instead of Q).

### 4.3 Setup B — keyboard + trackpad

A trackpad is less precise and makes holding a button harder, so this setup gets its own tuning.

- **Look:** slide one finger. Pointer Lock works with a trackpad (desktop browsers and iPadOS Safari). The trackpad has its **own sensitivity** and optional **acceleration** in the settings.
- **Strike: click** (or tap, if tap-to-click is on). The direction comes from the **finger movement in the last 0.15 s**, as with the mouse. Or use **J / I / L** for exact directions.
- **Heavy strike:** press and hold the click, then release.
- **Block: two-finger click** (the right button), held. Or hold **K**.
- **Parry:** a **two-finger tap** at the moment of impact. Or tap **K**.
- **Archer:** two-finger click and hold to draw, then click to loose. Or hold **K** to draw and press **J** to loose.
- **Two-finger swipe up or down:** switch squad.
- **Help for trackpads** (on by default in this setup, can be turned off):
  - **Auto-guard:** while blocking, your guard turns by itself to the side the nearest enemy is striking from. You still need the timing for a parry.
  - **Look assist:** looking slows down a little when the crosshair is over an enemy.

### 4.4 Setup C — keyboard + touchscreen

Move with the keys; look and fight with the right hand on the screen. **There's no move stick**, because W A S D do that.

```
┌──────────────────────────────────────────────────────────────┐
│ [① ② ③ ④ squads]       ─ compass ─          [scroll] [≡]     │
│                                                              │
│   (the whole screen, except the buttons: drag with one       │
│    finger to look)                                           │
│                                                              │
│                                              [ ORDER ]       │
│                                     [ BLOCK ]      [ ABIL ]  │
│                                          ( STRIKE )          │
│                                     [ KICK ]      [ USE ]    │
│ ▰▰▰▰▰▰▱▱ health   ▰▰▰▰▱ stamina         arrows 18  bandages 3│
└──────────────────────────────────────────────────────────────┘
```

- **Look:** drag one finger anywhere that isn't a button.
- **STRIKE:**
  - **Tap** = a light strike in the last direction.
  - **Swipe off the button** left, right or up = strike from that side (the swipe is the direction).
  - **Hold** = heavy strike.
- **BLOCK:** hold; slide your finger left, right or up while holding to turn the guard. Tap at the moment of impact to parry.
- **Two fingers at once:** your look finger can stay down while the other thumb presses STRIKE or BLOCK. The screen handles several touches at once.
- **ORDER:** hold, and the wheel opens under your finger; slide, then lift. **Tap a squad badge** at the top to select that squad.
- **Tactical view:** in the tactical view you can **drag a squad's banner** onto the ground (move there) or onto an enemy (charge). This is the easiest way to command by touch.
- **Help for touch** (on by default in this setup): **auto-guard** as in 4.3, and a light **aim assist** (the view drifts a little toward the enemy you are facing, and the bow aim slows over a target).
- **Layout:** the buttons are half-transparent, can be **moved and resized** in the settings, and there's a **left-handed** mirror.
- **All keyboard keys still work** here (J I L K included), so you can mix.

### 4.5 Settings for each setup

| Setting | Mouse | Trackpad | Touchscreen |
|---|---|---|---|
| Look sensitivity | ✔ | ✔ (separate) | ✔ (separate) |
| Invert up/down | ✔ | ✔ | ✔ |
| Acceleration | — | ✔ | — |
| Auto-guard | off | **on** | **on** |
| Aim / look assist | off | light | light |
| Strike direction from movement | ✔ | ✔ | swipe |
| Button layout editor | — | — | ✔ |

Also, the same for all setups:
- **Field of view:** 60–95°.
- **Comfort:** head bob, camera shake.
- **Difficulty.**
- **Show key hints:** small key letters on the HUD, e.g. `[F] Climb`, that change with the device: a key letter, a click icon, or a button.

### 4.6 Later, if wanted: a game controller

The Gamepad API is cheap to add:

| Control | Action |
|---|---|
| Left stick | Move |
| Right stick | Look |
| RT / LT | Strike / block |
| A | Dodge |
| B | Kick |
| X | Use |
| Y | Ability |
| LB | Order wheel |
| RB | Cycle squads |
| D-pad ↑ ← → ↓ | Follow / Hold / Charge / Form up |
| View button | Tactical view |
| Start | Pause |

This isn't part of the first milestones.

---

## 5. How fighting feels

### 5.1 Melee: three directions, stamina, and timing

- **Every strike and guard has a direction:** left, right or overhead. A strike is stopped by a guard in the **same** direction. So you watch the enemy's arms: a raised blade means overhead.
- **Parry:** a guard started within **0.2 s** of the enemy's strike landing (0.3 s on Easy).
  - The attacker staggers for 0.8 s.
  - Your next strike is a **riposte** for double damage.
  - A clean parry gives a bright ink flash and a sharp *kin!* sound.
- **Stamina** (the brush bar) is used by strikes, heavy strikes, dodges, running and blocked hits. It refills when you stop attacking.
  - At zero stamina your guard breaks and you stagger. This is where most fights are lost.
- **Heavy strikes** break guards: the only answer is to dodge or parry.
- **Kick / shield-bash** pushes an enemy back and cancels their strike. Use it to escape two attackers, or to knock someone into the river.
- **Hit zones:**
  - Head ×1.6 (a kabuto helmet reduces it)
  - Torso ×1
  - Legs ×0.7, but the target slows for 2 s
  - Iron armour takes 30% off body hits. It's the same armour you forge at the smithy.
- **Crowds:** only **two** enemies can attack you at once; the rest circle, wait or throw things. This is what keeps it fair, and it's a known trick from good melee games. Surrounded by five is still very dangerous, because the two swap in fresh.
- **The death blow:** a staggered or crawling enemy can be finished with **F**. It's a short, not gory, ink-splash cut, and it raises your squad's morale.

### 5.2 Weapons by soldier class

| You play as | Weapon | Feels like | Special |
|---|---|---|---|
| **Ashigaru** (spearman) | Yari | Long reach, fast thrusts, weak up close | Brace the spear (hold block while standing still): enemies and horses running at you are impaled. Strongest in a line of spears |
| **Shield-bearer** | Sword + tall shield | Slow, very tough | Blocks arrows from the front automatically; **shield wall** with your squad; shield-bash |
| **Archer** | Yumi + tantō | Deadly at range, weak up close | Draw time 0.9 s; arrows drop with distance; wind shown by banners; 24 arrows, pick up more; a quick tantō slash when cornered |
| **Samurai** | Katana | Fast, all three directions, strong parry | **Iai:** a sheathed first strike that does double damage |
| **Ninja** | Ninjatō + kunai + smoke | Fragile, quiet, fast | Crouch-walk is nearly silent; **assassinate** from behind (F); grappling hook up walls (F on a wall); 3 kunai; 2 smoke bombs |
| **Sōhei** (warrior monk) | Naginata | Wide sweeps that hit two | A prayer (G) heals nearby friends a little and raises morale |
| **Cavalry** | Horse + yari | Fast, devastating charge | **Mount / dismount** with F; the lance charge knocks enemies down; the horse can be wounded; braced spears are deadly to you |
| **Berserker** (commander) | Kanabō (iron club) | Slow, crushing, huge health | Heavy strikes hit everyone in front; skills from his tree (§6.6) |
| **Taishō** (commander) | Katana + war fan | Balanced | Commands everyone in a big radius; banners and rallies from his tree (§6.6) |

### 5.3 Ranged, walls and siege

- **Arrows:** real projectiles with drop and flight time. Rain shortens range and weakens arrows (as today); wind drifts them.
- **Towers:** climb with **F** at the ladder. Archers up there see far.
- **Walls:** a level-2+ wall has a walkway; climb it with F at stairs or ladders. Enemies on walls take 20% less damage.
- **Ladders:** your squads can carry **ladders** (bought at the muster, like rams). Order a squad to "Scale here" at a wall, and they raise the ladder and climb. The enemy can push it down (kick it with E yourself to do the same to them).
- **Gates:** a ram crew (a squad with a ram) batters the gate. You protect them. Or you open the gate from the inside: climb in with a ninja and press F at the gate bar.
- **Catapults:** as today, but ordered from the order wheel ("Fire at…", then look at a building).

### 5.4 Difficulty ("very challenging")

| | Easy | Normal | Hard |
|---|---|---|---|
| Parry window | 0.30 s | 0.20 s | 0.15 s |
| Enemies attacking you at once | 1 | 2 | 3 |
| Enemy reaction | slow | human-like | fast, feints |
| Downed hero | always recovered | 12 s to be dragged or taken over | no taking over |
| Auto-guard (trackpad / touch) | always | on by default | off by default |
| Aim assist (trackpad / touch) | strong | light | off |

The existing save difficulty (`DIFFICULTY`) picks the column, and can be changed in the battle settings.

---

## 6. Commanding your men while you fight

### 6.1 Squads

- Up to **4 squads plus you.** Each has a **banner bearer** (visible from far away, in its colour) and a **sergeant** (the highest rank in it).
- **Squad cards at the top of the screen** show: the class icon, the number left (e.g. 8/10), a **morale** brush stroke (green → yellow → red), and the current order as a small word ("Hold", "Charge").
- **Squads act on their own when given no order:**
  - They **follow you** by default, at a short distance behind in formation.
  - They fight whatever attacks them.
  - Archers stay back and shoot at whatever your crosshair was last on.

### 6.2 Orders

Hold **Q** (or the middle mouse button, or the ORDER button on a touchscreen) to open the wheel. Point at a slice (pointer, finger or W/A/S/D) and release.

```
                 CHARGE
        FOLLOW           HOLD HERE
   FALL BACK     (squad)       FORM: line / wall / loose
        LOOSE / FIRE AT   SCALE / RAM / OPEN
                 ALL SQUADS
```

- **Where an order applies:** the point you are **looking at**. A glowing ink ring appears on the ground; on an enemy, a red brush mark.
- **Who gets it:** the selected squad (1–4), or "all squads".
- **Your hero shouts the order out loud.** A subtitle shows it: "Spears — hold the ford!". The sergeant answers ("Hai!"), and the banner dips.
- **Orders take time to spread.** Squads further than 30 m react 1 to 2 s later, unless a Taishō is present (Swift Orders removes this).
- **Formations:**
  - **Line:** two ranks, the best frontage for spears.
  - **Shield wall:** shields only; arrows are blocked, movement is slow.
  - **Loose:** spread out, better against arrows and catapults.
  - **Wedge:** cavalry, samurai.

### 6.3 Morale: the heart of the challenge

- Every squad has **morale** from 0 to 100.
- **It drops when:** friends fall nearby, they are flanked or shot from behind, they are outnumbered, their banner bearer falls, or **you** fall.
- **It rises when:** enemies fall, you shout (T), you fight in front of them, a Taishō's banner is near, they win a fight, or a sōhei prays.
- **At 25 or below,** the squad **wavers**: it stops obeying far orders. **At 0** it **breaks** and runs. You can rally a broken squad by running to it and shouting (T) within 8 m.
- **The enemy has the same system.** Breaking their morale is how most battles are won: kill their captain, burn their banner, surprise them from two sides.

### 6.4 Tactical view (Tab)

- The camera lifts out of your hero's head to an ink-wash overhead map of the battlefield.
- **Time slows to 25%.** It does not stop, so it stays challenging.
- Squads are shown as banners, enemies as red marks, with seen and heard enemies only (the fog of war stays).
- **Give orders:**
  - Drag a squad's banner (mouse, trackpad or finger) onto the ground to move it there, or onto an enemy to charge it.
  - Drag a squad to a wall to scale it, or to a gate to ram it.
- **Leave** with Tab again. You also leave it automatically if your hero is attacked.

### 6.5 Your squad-mates' AI

- **Formation slots** around a banner, **not** the old free-for-all.
- **In a fight:**
  - Each soldier picks a foe in front of the formation, fights, and falls back into the slot.
  - The front rank fights while the back rank waits.
  - The wounded swap to the back.
- **Archers** keep a distance of 20–40 m and move away from charging enemies. They never shoot into a melee with friends in the line of fire (no friendly fire from AI arrows; your own arrows can hit friends on Hard).
- **They help you:**
  - If you are fighting two, the nearest free squad-mate comes to take one.
  - If you are down, the nearest one drags you back.

### 6.6 Commanders: their skill trees become your abilities

When you play a commander, the skills you learned in the War Room turn into things **you** do. The **G** key (or the ABIL button on a touchscreen) uses the active one; hold G to choose between several.

| Skill (War Room) | In first person |
|---|---|
| **Iron Hide** (Berserker) | +40% health and no stagger from light strikes |
| **Oni Strength** | Heavy strikes knock enemies down |
| **Quick Climb** | Climb walls anywhere without a ladder (F on a wall) |
| **Great Cleave** | Ability: a 360° sweep that hits everyone around you (cooldown 20 s) |
| **Bloodlust** | Every kill heals you 8% and refills stamina |
| **Unstoppable** | Ability: 8 s of no knockback, and your guard cannot be broken |
| **War Council** (Taishō) | All squads start with +15 morale |
| **Tall Banner** | Your orders reach every squad instantly, anywhere on the field |
| **Swift Orders** | Squads move 15% faster; no order delay |
| **Banner of Courage** | Ability: plant your banner — squads near it cannot break for 30 s |
| **Living Legend** | Enemies near you lose morale just from seeing you |
| **Iron Discipline** | Squads take 20% less damage while in formation |

Command points and War Games stay exactly as they are. Commanders still earn points in battle (kills, surviving).

---

## 7. The enemy

- **Roles:** sentries on routes, guards at gates, archers on towers and walls, a **captain** (the strongest, with a crest), and a **reserve** in the keep that comes out when you break in. The shogun's castle and warlords also have a **lord**.
- **Before the alarm:**
  - Sentries walk routes and look around.
  - A **suspicion meter** (an ink eye over their head) fills when they see you or hear you. Running is loud; crouching in grass or bushes is quiet; night and fog help you.
  - A thrown stone (G) draws them to the noise.
  - When the alarm rings (a bell or drum), everyone arms and takes their role.
- **After the alarm:**
  - They form lines at the gate.
  - Archers shoot at whoever is closest in the open.
  - The captain leads a **sally** when they outnumber you.
  - Fighters fall back to the keep when their line breaks, and fight their last stand there.
  - They may **ask for surrender** when outnumbered 3 to 1: a messenger with a white flag, and you accept (F) or refuse.
- **Enemy fighting:** they use the same rules as you (directions, stamina, parries), with difficulty-scaled reactions. Hard enemies **feint**: they start overhead and switch to the left.
- **The duel:** when you come near the enemy captain or lord, he may challenge you. A banner circle forms and both armies hold back and watch. Win, and his men lose half their morale. Lose, and yours do.
- **Clan look:** enemy troops wear their clan's colour (Uesugi blue, Mōri green, Hōjō purple, bandits in rags) and fly clan banners with the clan crest.

---

## 8. Enemy places look like real places

This is the second big complaint: today's enemy bases are a few level-1 pieces inside a ring. The new places are **generated like a village someone lives in**, from the same `MODELS` as your own village, **at the right levels**.

### 8.1 How a place is built (the generator)

1. **Terrain first:** a heightmap for the valley (§9), then the place sits where a real one would: a village on flat ground by the river, a fort on a rise, a castle on a hill with a steep side.
2. **A main road** comes in from your side and leads to the centre. Side roads branch off it (the same dirt / stone road tiles as the village).
3. **A centre:** the headman's house (village), a well and shrine, or a keep (fort/castle). The keep is the **townhall model at the site's level** (fort: level 2, castle: 3–4, Shogun: 5).
4. **Houses along the roads,** facing them: minka, nagaya and a samurai manor for richer places. Storehouses near the centre, a lumber camp by the trees, a quarry or mine against a hill.
5. **Fields outside:** rice paddies with water on flat ground by the river, farms, drying racks, scarecrows.
6. **Defences by type:** palisade → stone walls with walkways (level 2+) → gate towers (the 3-wide gate) → yagura towers at the corners → an outer and inner ring for castles.
7. **Life:** smoke from chimneys, lanterns at night, laundry, carts, a dog. **Civilians** run into the houses when the alarm rings. They cannot be hurt; there are no massacres in Tenka.
8. **Clan colours** on banners, the clan crest on the keep curtain.
9. **Always the same for a place** (seeded by `site.seed`), so a scout's report matches what you find.

### 8.2 By type

| Place | What it looks like | Defenders |
|---|---|---|
| **Hideout** | Two or three huts in a forest clearing, a campfire, stolen goods under tarps | 4–6 outlaws, no walls |
| **Bandit camp** | A rough palisade with a gap, tents, a watch platform, a cooking pit | 8–12 bandits, 2 archers on the platform |
| **Village** | 8–14 houses along a road, rice paddies, a shrine, a small palisade and gate; the headman's house in the middle | 10–16 ashigaru, archers on two towers |
| **Mountain pass** | A narrow road between cliffs, a wooden gate-fort across it, towers on the rocks | 12–18, many archers |
| **Fort** | On a rise, stone base walls with walkways, a gate tower, barracks (nagaya), a small keep level 2 | 16–24 |
| **Small castle** | Two rings: an outer palisade with houses between, an inner stone ring, keep level 3 | 22–30, a captain |
| **Castle / Warlord** | On a hill: a town of houses and markets below, outer and inner walls, several towers, keep level 4, a moat where the river allows | 30–45, a captain and the lord |
| **Shogun's castle** | Like Himeji: a white keep level 5, three rings, a stone ramp, a moat, gardens | 45–60 plus elite samurai and the lord |

### 8.3 Performance budget (iPad)

- At most about **70 buildings** per place.
- The same model is built once and cloned. Far buildings merge into one mesh per material.
- At most **60 people** on screen, fighting at full detail. People further than 60 m use half-rate animation.

---

## 9. Land and rivers that look real

### 9.1 Terrain

- **Heightmap:** noise with ridges plus a valley shaped by the river.
  - The battlefield is **256 × 256 m** (twice today's).
  - The playable area has soft edges (mist and steep slopes, no invisible wall). Mountains are in the distance.
- **Slopes matter:**
  - Walking uphill is slower and costs more stamina.
  - Fighting from above gives +15% damage.
  - Very steep ground can't be climbed.
- **The ground has painted detail:** grass, dirt paths worn by the roads, mud near the river, moss, scattered stones. Seasons as in the village: snow, autumn colours, spring blossom.

### 9.2 Rivers (no more straight strips)

1. **Path:** a river starts at a high point off the field and flows downhill. At each step it moves toward lower ground plus a slow **noise wiggle**, so it meanders. The path is smoothed into a spline.
2. **Width** varies along the way (6–14 m): wide in flat meadows, narrow and fast between rocks.
3. **The terrain is carved:** the riverbed is lowered with soft banks. **Shallows (fords)** are where the bed is high. Inside bends get **gravel bars**, outside bends steep **cut banks**.
4. **Water surface:**
   - A ribbon mesh that follows the spline, with slow flow lines moving downstream.
   - Foam at rocks and banks, and reflections of the sky colour.
   - Night and rain darken it.
5. **Around it:** reeds, willows, stepping stones at fords, boulders in fast parts. Sometimes a **wooden bridge** where a road crosses (a *taiko* arched bridge near castles, a plank bridge near villages), and a watermill near villages.
6. **Gameplay:**
   - Fords are walkable but **slow (40%)**, and you can't dodge or run there.
   - Deep water is not walkable. Anyone knocked in is swept a little downstream and climbs out.
   - Bridges are **chokepoints**, perfect for a line of spears.
   - Archers on the far bank are safe from melee.
7. **Also used elsewhere:** the **country map** gets real river splines instead of noise ditches (rivers flow from the mountains to the sea). Your **home village** can get a stream the same way (optional, later).

---

## 10. How it looks and sounds

### 10.1 The first-person view

- **Field of view:** 75° (adjustable 60–95). Eye height 1.6 m (1.1 when crouching).
- **Head movement:** a very light bob when walking, a sway when running, a short shake when hit. Everything can be turned down under "Comfort" in the settings (motion sickness).
- **Your hands and weapon** are drawn in front of you (a **view model**): the same low-poly style as the game — sleeves in your class colour, the yari, katana or bow.
  - Strike animations are fast and readable, with a short **ink trail** behind the blade.
  - Blocks raise the weapon to the guard side.
  - The shield takes the lower left of the screen.
- **Enemy tells:** the enemy raises the weapon to the side it will strike from, with a faint red ink glint at the blade 0.3 s before the blow (the parry cue). Hard difficulty removes the glint.

### 10.2 The HUD (Tenka's paper-and-ink style)

```
 ①Spears 8/10 ▰▰▰▱  ②Shields 5/6 ▰▰▰▰  ③Bows 6/6 ▰▰▱▱ HOLD      ─── N ─── ◆ gate ───
                                                                       [scroll]
                                  ·   ← crosshair: a small ink dot; turns into a
                                          ring when you can parry, red when blocked

 ▰▰▰▰▰▰▰▱▱▱  Hayato ★  (health: a red brush stroke)            🏹 18   ✚ 3
 ▰▰▰▰▰▱▱      (stamina: an ink brush stroke)
```

- **Squad cards** top left; the **compass** top centre with the objective and your squads' banners; the **health and stamina** brush strokes bottom left; **arrows and bandages** bottom right.
- **Subtitles** for shouts in the lower middle: "Shields — form a wall!"
- **Damage** is shown as red ink **splatter at the screen edge** toward the attacker. Low health adds a heartbeat and a desaturated, ink-wash edge.
- **No floating damage numbers:** it should feel real.

### 10.3 Sound (all synthesised, like today, plus a few new sounds)

- Steel on steel (*kin*), a thud on a shield, the whoosh of an arrow passing close.
- The bow creak while drawing, the drum and bell for the alarm, the horn for your charge and retreat.
- Shouts ("Tenka!", "Hai!", "Ikuzo!" — let's go!), footsteps changing on grass, stone, wood and water, and the river sound growing louder as you get close.
- Music: quiet taiko while sneaking, rising when the alarm rings, full drums in the fight.

### 10.4 Light and weather

- Same sky, sun, moon, fog, rain and snow as the village. Night battles are **dark**: torches, lanterns and moonlight, and enemies at night are hard to see (and so are you).
- Fog is dense in the valley at dawn, and rain makes the ground muddy and slower.

---

## 11. The code: how it's built

### 11.1 New files (the old `battle.js` is removed at the end)

```
js/fp/
  fpmode.js       entering/leaving the mode, the loop, win/lose, results → battleEnded
  controller.js   the player: capsule movement on the heightmap, stamina, crouch, dodge, climbing
  input-fp.js     the keyboard, device detection (mouse / trackpad / touch), pointer lock,
                  strike direction from pointer movement, J/I/L/K backups, auto-guard, look assist
  touch.js        the touchscreen: look-drag, strike/block/order buttons, multi-touch, layout editor
  viewmodel.js    the hands and weapon in front of the camera + their animations
  melee.js        strikes, guards, parries, hit zones, stagger — shared by player and AI
  ranged.js       arrows, kunai, stones, catapult boulders (projectiles with drop)
  squads.js       squads, formations, orders, morale, banner bearers
  ai.js           soldier AI (friend and foe): the state machine + the "two at a time" rule
  enemy.js        enemy roles: sentries, suspicion, alarm, sally, fall-back, surrender, duel
  place.js        the place generator (§8): roads, houses, fields, walls, keep, civilians
  terrain.js      the heightmap, slopes, ground painting, trees and rocks (instanced)
  river.js        the river spline, carving, water ribbon, fords, bridges, reeds
  hud-fp.js       the HUD, squad cards, compass, subtitles, order wheel, the tactical map
  sfx-fp.js       new synthesised sounds
```

### 11.2 How the pieces fit

- **Mode switch:** the existing `setView({active, cam, update})` hook in main.js. `fpmode` provides a camera object with `.target` (the player position), so the `Stage` keeps the sky, shadows and weather centred.
- **Collision:**
  - No physics engine. People are **capsules**. The ground is the heightmap.
  - Buildings, walls and rocks are **boxes** in a coarse grid (1 m cells) for quick tests.
  - Wall walkways and towers are **floors** you can stand on.
- **AI movement:** a **navigation grid** (1 m cells) with A* for long paths, plus local steering to avoid each other. A **spatial hash** replaces the O(n²) separation.
- **Hit detection:**
  - Each strike is a short **arc sweep** (a few rays along the blade over the strike's active frames) against capsules with head, torso and leg zones.
  - Timings are defined per weapon in data (wind-up, active, recovery), so balance lives in one table.
- **Animation:** extends `Person.animate`. New poses: `guardL / guardR / guardUp`, `strikeL / strikeR / strikeUp / thrust`, `stagger`, `down`, `crawl`, `drag`, `climb`, `bow-draw`, plus a hit flinch as an additive layer.
- **Performance targets (iPad):**
  - 60 fps with 40 people on screen, and at least 30 fps with 80.
  - Dynamic resolution (already in main.js).
  - Instanced trees and grass; one merged mesh per place for the far buildings.
  - No per-frame allocations. Night uses a fixed number of lights, with torch glow faked by the `MAT.glow` material, so shaders don't recompile.
- **Save:** nothing mid-battle (as today). Results go through the same `battleEnded` path: wounds, deaths, credit, loot, hold.
- **Testing:** a hidden **sandbox** (`?fp=sandbox`): a field, a dummy, a few enemies — for tuning the feel without a campaign.

---

## 12. Later: defend your own village in first person

Phase 2 (after the attack battles feel good):
- When raiders come, the new **"Take the field"** button puts you into first person **in your own village**, with your soldiers as squads.
- It uses the same controller, melee, squads and AI, on the village terrain and buildings.
- `raids.js` keeps the raid planning (who comes, from where, ladders, rams). The fighting is handed to the new system.

---

## 13. Milestones (each ends with something playable)

| # | Milestone | Done when… |
|---|---|---|
| **M0** ✅ | **Sandbox walk** | You can walk, run, crouch and look in first person over a generated valley with a winding river, with **all three setups**: keyboard + mouse, keyboard + trackpad, keyboard + touchscreen. 60 fps on the iPad |
| **M1** ✅ | **Melee vs a dummy** | Directional strikes, guard, parry, stamina, the view model and hit sounds, with every setup (mouse direction, trackpad click and two-finger click, touch buttons with swipes, J/I/L/K). It feels good hitting a straw dummy |
| **M2** | **One enemy** | An AI swordsman who fights by the same rules: parry cues, feints on Hard. A 1v1 is winnable but tense |
| **M3** | **Squads and orders** | You plus two squads against a group: Follow, Hold, Charge, Form up, the order wheel, morale and breaking, the tactical view |
| **M4** | **Places** | The generator builds all place types from the village models, at their levels, with roads, fields, clan colours and civilians hiding |
| **M5** | **Rivers and terrain** | Meandering carved rivers with fords and bridges on battlefields **and** the country map |
| **M6** | **Walls and siege** | Towers, walkways, ladders, rams, gates, catapults; archers and the bow |
| **M7** ◐ | **All classes** (in the training yard; riding and the ninja's stealth still simple) | Samurai, ninja (stealth, hook, smoke), sōhei, cavalry (riding), shield-bearer (shield wall) |
| **M8** | **Commanders** | Berserker and Taishō with their skill trees as abilities |
| **M9** | **Into the game** | Muster screen → march → battle → aftermath. **The old battle.js is removed.** Defence of held places uses the new mode |
| **M10** | **Polish** | Enemy duels, surrender, sounds, music, comfort settings, lefty and button layout, balance of difficulty. README and backup |
| *M11* | *(Phase 2)* | *Defend your own village in first person* |

Each milestone is committed and pushed separately. While the new mode isn't finished, the Menu offers a switch: **Battles: classic / first-person (preview)**, so the game stays playable the whole time.

---

## 14. Questions to decide before building

1. ~~Controls~~ **Decided:** keyboard always, plus a mouse, a trackpad or the touchscreen (§4). Each milestone is tested with all three.
2. **Gore:** the plan keeps it clean (ink splashes, no blood pools). OK?
3. **Death of your hero:** the rules in §3.2 (down → dragged back or take over → can die for good). Too harsh, or harsh enough?
4. **Real time with no pause** (only the 25% slow tactical view): is that the challenge you want?
5. **The first milestone to try:** M0 + M1 together (walk and fight a dummy) is a good first test of whether first person feels right on your iPad.
