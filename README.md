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
| Q / E | Rotate the camera |
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

- **Villagers do the work.** Assign them to fields, lumber camps, quarries and mines. They walk out, work, and carry goods back to the keep or a storehouse. Idle villagers build new buildings on their own.
- **Resources:** wheat, wood, stone and gold. Villagers eat wheat; new families move in when there are empty houses and spare wheat.
- **Harmony:** shrines, gardens, koi ponds, tea houses, sakura trees and lanterns make everyone work faster. Idle villagers relax and pray there. At night they go home and the lanterns glow.
- **Build freely:** place and rotate anything, move buildings later, and draw walls, bamboo palisades, spike barricades and hedges as lines.
- **Army:** recruits train at the Dojo (Ashigaru spearmen) and the Kyūdō Range (Yumi archers). Archers climb Yagura towers and keep watch.

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
