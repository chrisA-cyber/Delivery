# How the second build was designed

On November 17, 2026 we read the creators' Roblox listings and inspected their current listing thumbnails. These observations concern the published art and advertised game loops. No competitor art, code, UI or recordings were imported.

| Reference | What the creator shows | Decision in Delivery |
|---|---|---|
| [Epic Minigames](https://www.roblox.com/games/277751860/Epic-Minigames) | Its cover makes the red obstacle readable against an open blue setting. The listing describes distinct minigames, progression from wins and cosmetic gear. | Lead with a short, playable sound-pad act. Highlight the upcoming cue and award a visible result from actual input. |
| [Dress To Impress](https://www.roblox.com/games/15101393044/Dress-To-Impress) | Its runway and audience voting give people complementary jobs. The seasonal cover puts a single character in warm light against a violet background. | Introduce performers and audience members as explicit roles. Give Flip a face, the performer a mark, and the audience a clear decision on each beat. |
| [DOORS](https://www.roblox.com/games/6516141723/DOORS) | A practical light above a doorway makes a destination distinct within a dark scene. The creator recommends learning from each attempt. | Use built-in lights, the gauge, framed signs, footlights and changing stage indicators to point to the next action. Give players specific feedback after each timing attempt. |

The arrival design gives players direct control in the district. Performing, watching and exploring are separate choices. The current card carries one instruction at a time, the pad lesson happens during the actual act and the result shows what the player earned. Device tests exercise the same controls in Studio used by players. [Roblox onboarding](https://create.roblox.com/docs/production/game-design/onboarding-techniques) · [Roblox accessibility](https://create.roblox.com/docs/production/publishing/accessibility)

## External GitHub sources in the game

| Project and pinned source | Actual use | License |
|---|---|---|
| [Sleitnick/RbxUtil](https://github.com/Sleitnick/RbxUtil/tree/639440dd551a4d3bfda0f6dbc56ad42e3969f706/modules) | The upstream Trove module owns each local microphone session's audio instances and recognition listener. Stop, timeout and retry clean them through one scope. The server clock adapts the Timer.simple interval pattern from the same revision. | MIT, included under third_party/trove. |
| [Feather Icons](https://github.com/feathericons/feather/tree/1b002399e8758fb2bccea4d07312dc9e0f43dcb8/icons) | The original SVGs for the twelve selected symbols are checked in. The build ships native, tintable Roblox strokes for the microphone, headphones, audience and other selected controls. They work inside the offline place without uploaded image IDs. | MIT, included under third_party/feather. |

Both projects are pinned locally. Opening the game makes no request to GitHub. The checked-in FeatherPaths module is ready to use. To change a symbol, regenerate with `python tools/feather.py` from roblox/ using the Python fontTools package.


## Walkable campus

The second round of player feedback asked for room to roam and things to do away from the performer queue. Brookhaven presents a place for friends to roleplay in multiple locations. Theme Park Tycoon 2 describes a shared destination built around distinct attractions. Delivery applies those patterns to a connected broadcast campus. A map, physical signs, arcade lanes and a ramp connect the theatre to a plaza, workshop, writers’ loft, warehouse, atelier and rooftop lounge. The main show continues while other people choose a side activity. The subsequent open-world revision extends public streets to the pier, park and market, lets new arrivals walk immediately, and connects the waterfront and park with an optional sightseeing streetcar. [Brookhaven RP](https://www.roblox.com/games/4924922222/Brookhaven-RP) · [Theme Park Tycoon 2](https://www.roblox.com/games/69184822/Theme-Park-Tycoon-2)
