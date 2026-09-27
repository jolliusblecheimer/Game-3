# Tenka — how fighting and commanding will work (after the training yard)

*This builds on `first-person-battles.md` and replaces its combat and command chapters where they differ. It follows the controls you chose: click = left/right combo, hold = heavy overhead, right = block (face the strike) with a calm counter, bows aim with right and loose with left. The split-second parry stays shelved.*

---

## 0. Where we are

The **training yard** works with every soldier. There are straw dummies, a sparring post that strikes back, archery targets and an armoury.

The next steps turn the post into **people**, one person into **squads**, and the yard into **real battles** in the world.

---

## 1. Fighting real enemies (next step: M2)

### 1.1 Every soldier fights by your rules

Enemies (and later your own men) use the **same `Fighter` as you**: the combo, heavy overheads, blocks, the counter window, stamina and kicks. What changes is only **who presses the buttons**: an AI brain instead of your hands. So what you learn in the yard is exactly what works in battle.

### 1.2 How an enemy duels

Each enemy runs a small loop, 4–8 times a second, and chooses from what it sees:

| It sees… | It tends to… |
|---|---|
| You winding up a cut | **Block** (after its reaction time) |
| You holding your block for long | Wind up a **heavy overhead** to break it, or **kick** you |
| You charging a heavy strike | **Step back** or **strike quickly** to interrupt you |
| Its stamina low | **Back off** and circle until it recovers |
| You out of stamina | **Press the attack** with a full combo |
| Its block succeeded | **Counter** at once (like you do) |

**Reaction time and mistakes** make the difficulty:

| | Easy | Normal | Hard |
|---|---|---|---|
| Reaction time | 0.45 s | 0.3 s | 0.2 s |
| Blocks it misses | 1 in 3 | 1 in 6 | 1 in 12 |
| Feints (cancels a cut into a block) | never | sometimes | often |
| Uses heavies to break turtles | rarely | yes | always |

### 1.3 Seeing what's coming

- Enemies raise their weapon visibly before a cut. The **red ring** (orange for a heavy) lights on your crosshair when an enemy **in front of you and in reach** starts one, like the sparring post.
- An **edge marker** in red ink flashes on the side of the screen when someone attacks you **from outside your view**.
- You can switch the rings off for more challenge (the setting already exists).

### 1.4 Crowds: "two at a time"

- Only **two enemies may attack you at once** (one on Easy, three on Hard). The others circle, hold their shields up, or wait for an opening. When one of the two backs off, another steps in.
- This keeps fights fair and readable without making crowds harmless. Five around you is still very dangerous.
- A **shield wall or spear line** of your own men breaks the rule in your favour: enemies must deal with them first.

### 1.5 Hits, falls and deaths

- **Stagger** after a hit taken mid-cut, a kick, or a broken block.
- **Knockdown** from the kanabō heavy, a cavalry charge, or a shield-bash at the right moment. The soldier gets up after about 2 seconds, and a knocked-down enemy can be finished.
- **Wounded:** at low health, enemies may stagger away or crawl. They can surrender.
- **Death:** a fall and an ink splash; the body stays. No gore, as decided.
- Your hero: down → dragged back by a squad-mate, or take over another soldier (as in the main plan).

### 1.6 Archers against you

- Enemy archers **visibly draw** before loosing.
- A **block stops arrows from the front** only when you carry a **shield**. Otherwise **dodge** (Space), or use cover: walls, trees, houses.
- Arrows fly as real projectiles and can hit their own men.

---

## 2. Your squads (M3)

### 2.1 Who comes

- At the **muster** before a battle you pick your hero and up to **four squads**, sorted by class: Spears, Shields, Bows and Specials (ninja, sōhei, cavalry).
- Each squad has a **banner bearer** in its colour and a **sergeant**, its highest rank.

### 2.2 Giving orders (the same keys in every setup)

| Key | Order |
|---|---|
| **1 2 3 4** | Select that squad · **5** = all squads |
| **Z** | **Follow me** (the default) |
| **X** | **Hold here**, where you're looking |
| **V** | **Charge** what you're looking at |
| **B** | **Form up**: cycles line → shield wall → loose → wedge |
| **Q** (hold) | **Order wheel**: all orders, including Loose / fire at, Scale the wall, Ram the gate, Fall back and Stand fast |
| **T** (hold) | **Shout**: raises the morale of squads near you (and alerts enemies) |
| **Tab** | **Tactical view**: time slows to 25%; drag a squad's banner to move it or onto an enemy to charge |

- **Mouse and trackpad:** the order wheel follows the pointer; the scroll wheel or a two-finger swipe also switches squads.
- **Touchscreen:** tap a **squad badge** at the top to select it; hold **ORDER** for the wheel under your thumb; in the tactical view, drag the banners.
- **What you see:**
  - An **ink ring** marks where an order applies (a red brush mark on an enemy).
  - Your hero **shouts** it (subtitle: "Spears — hold the ford!").
  - The sergeant answers ("Hai!") and the banner dips.
- **Orders need time to travel:** squads more than about 30 m away react 1–2 s later, unless you are a Taishō (see 3).

### 2.3 Formations with the new melee

| Formation | Who | How it fights |
|---|---|---|
| **Line** | anyone | Two ranks. The front rank fights, the back rank waits and **swaps in when a man in front runs low on stamina** (so a good line wears the enemy down) |
| **Shield wall** | shield-bearers | Everyone blocks forward. Arrows from the front are stopped. Moves slowly. Only a **heavy overhead** or a flank breaks it |
| **Spear hedge** | spearmen, braced | Spears held forward, still. Anyone running at it, and **cavalry** especially, is hit first (reach 3 m) |
| **Loose** | anyone | Spread out. Good against arrows and catapults, weak in melee |
| **Wedge** | samurai, cavalry | For breaking a line: the tip hits first |

### 2.4 Archers

- **Free fire** (default): they shoot the nearest enemy they can see.
- **"Loose!" (order wheel, or V with the Bows squad selected):** a **volley** at the spot you're looking at, all together. That's good against a shield wall's flank, a gate or a crowd.
- They keep 20–40 m away, back off from charging enemies, and don't shoot into a melee where their own men are in the line of fire.

### 2.5 Morale: why you're in front

- Every squad has **morale** from 0 to 100, shown as a brush stroke on its badge.
- **It rises when:** enemies fall, **you fight near them**, you shout, a Taishō's banner is close, or they win a fight.
- **It falls when:** friends fall near them, they're flanked or shot from behind, their banner bearer falls, or **you fall**.
- **At 25 or below they waver:** they don't obey far orders any more.
- **At 0 they break** and run. You can **rally** a broken squad by running to it and shouting (T) within 8 m.
- **The enemy has the same.** Breaking their morale wins most battles: kill their captain, take their banner, or hit them from two sides.

---

## 3. Commanders (M8)

- Once appointed at the Keep, your **Berserker** and **Taishō** can be your hero.
- **Their War Room skills become your abilities** (G, or hold G to choose):
  - **Berserker:** Iron Hide (+40% health), Oni Strength (heavies knock down), Quick Climb (climb walls anywhere), Great Cleave (a 360° sweep), Bloodlust (kills heal), Unstoppable (8 s without knockback).
  - **Taishō:** War Council (+15 starting morale), Tall Banner (orders reach every squad instantly), Swift Orders (+15% squad speed), Banner of Courage (plant your banner: nearby squads can't break for 30 s), Living Legend (enemies near you lose morale), Iron Discipline (squads in formation take 20% less damage).
- **The Taishō's command signal (only if you want it):** the war fan is gone as a weapon. It could come back as the Taishō's way of giving orders: a quick raise of the gunbai when you order a charge. That's purely a visual, and nothing changes in how you fight.

---

## 4. Battles in the world

1. **Map → a place → Raid → the muster** (hero, squads, rams, ladders) → **march** → **arrive** at the edge of the valley.
2. **Deployment (about 20 s):** look over the place, give first orders, then press Enter to begin.
3. **The fight:**
   - **Enemy places:** real villages, forts and castles built from your own village's buildings at their levels, with roads, fields, clan banners, and civilians who hide.
   - **Terrain:** rivers wind with fords and bridges (as in the yard).
   - **Sieges:** walls have walkways, towers can be climbed, ladders can be raised, rams hit the gates.
4. **The end:** the enemy routs or surrenders; you take the keep or their banner; or you sound the retreat (hold Backspace).
5. **Aftermath:** wounds, deaths, ranks and loot, then Plunder or Hold, as today.
6. **Defending your own village** in first person comes later, using the same systems.

---

## 5. Build order (each step playable)

| Step | What you get | Done when… |
|---|---|---|
| **M2a** | **A sparring partner:** one AI swordsman in the yard who fights by your rules | A 1-v-1 is winnable but tense on Normal. Blocks, combos, heavies, counters and stamina all matter |
| **M2b** | **Bandits in a clearing:** 3–5 bandits (one archer) across the river from the yard | The "two at a time" rule, the edge markers, knockdowns and deaths work; archers draw and shoot |
| **M3a** | **One squad:** 6 spearmen who follow you | Follow, Hold and Charge work; the line rotates tired men; morale rises and falls |
| **M3b** | **Four squads, the wheel and the tactical view** | Shield wall, spear hedge, volleys and rallying a broken squad all work, on all three input setups |
| **M4** | **Real enemy places** | The generator builds every place type from the village models |
| **M5** | **Rivers on the country map too** | |
| **M6** | **Walls, ladders, rams, towers** | |
| **M8** | **Commanders' abilities** | |
| **M9** | **Into the game** | Map → muster → battle → aftermath; the old battle code is removed |

---

## 6. Small things to decide later (none block M2a)

- Should your squad-mates be able to **revive** each other, or only you?
- Should enemies **surrender** and be taken prisoner, for ransom in gold or to join your village as workers?
- A **"hard-core" option:** no red rings, no crosshair, and a heavy strike to the head kills outright.
