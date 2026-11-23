# Real animated characters for Cric365

Put ONE rigged character with animations in this folder, named exactly:

    player.glb

Every player on screen (batter, bowler, fielders, umpire, the team celebrating) is a copy of that one model.
Shirts are tinted with each team's colour, if the model's shirt material name contains one of: shirt, jersey, top,
torso, body, cloth, upper, outfit (change the words with "tint" in clips.json).

If player.glb is missing, the app keeps working with the built-in simple players.

## Which animations to include
Name them anything. Cric365 looks for these words in the animation names (not case sensitive):

| Needed for                         | Looked for in the name                          | If missing it uses |
|------------------------------------|-------------------------------------------------|--------------------|
| standing, waiting, batting stance  | idle, stand, breath, stance                     | (none)             |
| bowler run-up, fielder chasing     | run, sprint, jog                                | walk, idle         |
| batter hits the ball               | swing, batting, bat, strike, hit                | idle               |
| bowler delivers                    | bowl, pitch, throw, overarm                     | run                |
| celebrations (6, 50, 100, win)     | cheer, victory, celebrat, triumph, happy, win   | jump, clap         |
| clapping (milestones)              | clap, applause                                  | cheer              |
| jumping for joy                    | jump, hop                                       | cheer              |
| batter out                         | out, defeat, sad, disappoint, dead, lose        | idle               |
| umpire signals                     | signal4/four/wave, signal6/six, signalout/point | cheer              |

Open the browser console after the first four, six or wicket: it prints "Animation names found: [...]".
If a name is not matched, tell the app the exact name in `clips.json` (see `clips.example.json`, rename it to clips.json).

## Where to get a character (all free options need you to download and check the licence yourself)
* Mixamo (mixamo.com, free Adobe account): pick a character, then download animations such as Idle, Running, Baseball
  Pitching, Baseball Swing, Cheering, Clapping, Victory, Jump, Defeated. Combine them into ONE .glb with Blender
  (import each FBX, push each animation into the NLA / Action list, export glTF Binary with "Animation" ticked).
* Quaternius, Kenney and Poly Pizza have free CC0 animated character packs that already come as .glb with many clips.
* Ready Player Me avatars (.glb) can be used with animations retargeted in Blender.

Tips: keep the file under about 15 MB, T-pose or A-pose is fine, and the model should face the +Z direction (the default
for glTF). Cricket has few ready-made clips, so "Baseball Swing" and "Baseball Pitching" are the usual stand-ins.
