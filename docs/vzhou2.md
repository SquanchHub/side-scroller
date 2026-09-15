Repo and Codebase Organization:

The repo is mainly organized around the src and assets folders. Main.ts is the p5.js entry point and mostly just handles the game lifecycle. GameManager.ts controls the overall game state, input, resources, settings, sound, and current level. GameMap.ts handles most of the actual game world, including the level layout, player, enemies, powerups, projectiles, backgrounds, physics, and collision. InputManager.ts and GameAction.ts handle keyboard input and turn it into actions like moving, jumping, dashing, and firing. ResourceManager.ts loads the images, sounds, maps, and sprite configurations from assets.

The sprites are organized under src/sprites/. Sprite.ts is the base class, while Creature.ts handles enemy behavior and states. Player.ts contains most of the player-specific features, including normal movement, jumping, the dash ability, and the fireball ability. The dash gives the player a quick burst of movement and is triggered by a new dash key press. The fireball ability lets the player shoot projectiles while the ability is available. Projectile.ts handles the fireballs after they are created, including their movement, collision with tiles and enemies, and when they disappear. PowerUp.ts contains the different pickup types.

Each frame, the game updates the world, checks keyboard input, and then applies those inputs to the player. During the update, gravity and collisions are handled for the player and other objects. Movement is checked separately on the X and Y axes, which lets the player slide along walls instead of getting stuck. After that, enemies and powerups are updated, and fireballs are moved and checked for collisions. Dead enemies and expired fireballs are removed from the game.

When the game draws, GameMap.ts handles the camera and rendering. It follows the player while staying within the level boundaries, then draws the background, visible tiles, player, enemies, powerups, and fireballs. Overall, GameManager.ts handles the main game flow, while GameMap.ts and the sprite classes handle most of the gameplay and player abilities.





AI Tools Used:
I used Opengameart.org to source free public game audio for the music and the sound effects. The Claude extension in VSCode is the only AI tool I used. 

Session breakdown:

Git/logging cleanup:

16:55:07
- Asked Claude to adopt a T{n}/description branch-naming convention and remember it personally. Result: saved as a standing memory (no shared docs touched)

Planning the FireOrb feature: 22:56:41 to 00:06:27

- Asked for a structured plan (powerup + audio + tests + docs) grounded in the rubric and an existing graded report. 
- Directly shaped the plan's priorities; the code-exploration agent's findings became the technical blueprint 
- Asked to add a "manual verification before push" step,
- asked Claude to stress-test its own plan doc with it, plus add a "mean" self-code-review step. Used to launch three fresh "goldfish" agents (comprehension, critic, implementation-readiness) with no prior context, to see if the plan doc alone was buildable.
- Implementation-readiness-goldfish result came back with real, concrete blockers. This was used to revise the plan before any code was written, catching a bug pre-emptively.

Building and iterating on T5: 01:31:03 - 02:12:35

- Finished and report the completed FireOrb feature — 13 commits, fire ability, gravity projectile (with the pre-caught crash bug avoided), sound wiring, resource/map registration.
- Requested more powerups across maps, a fix for a creature/powerup-overlap collision bug, and ground-rolling/lifetime behavior for projectiles. 

Sourcing and wiring real audio: 02:24:25 - 04:01:59:

- I sourced audio manually, but asked for exact list of 4 new + 3 replacement sound files with target filenames, lengths, and feel.
- Implementing 4 of the sounds now. Used to land 3 commits (tests → wiring → assets) wiring background music, projectile-kill, Music Note pickup, and Heart pickup sounds; 
- Handed over 4 more filenames (flame, ignition, Plug-in, flyswatter) mapped to specific game events. 
- Requested a dedicated dash sound plus a cycling background-music queue triggered by Music Note pickups. Used to implement Player.dash() returning success/failure (so the sound only fires on a real trigger) and the queue mechanics.
- Used to actually build out SoundManager for real — centralizing every sound, removing GameMap's individual sound fields and Settings's sound state;

GitLab fork/MR mishap and recovery: 04:08:41 - 04:39:03

- accidentally pressed update fork on remote branch instead of creating MR
- Had claude diagnose the situtation and give me the commands to fix
    - just needed a local force push to fix repo history
- Asked for a walkthrough of repo organization and frame-by-frame data flow to help write docs/vzhou2.md in their own words. Got a structured explanation of Main.ts → GameManager → GameMap/sprites to help write this file

Honest assessment:
Claude helped a ton with debugging and was very quick at actually implementing code after planning. However, the planning phase took over an hour and a half of me interacting with claude, claude loading for a while, then getting back to me, then trying the elephant goldfish model. Much of the inefficiency after that was me having to review what its doing before allowing it to move on to the next task. Could have been sped up drastically if I changed its permissions or review the code.

Using AI is without a doubt faster and more convenient than designing and implementing code myself, but it still takes plenty of time to approve and review code. I can't reliable expect harnesses to implement code exactly how I want it without oversight, but the process also feels tedious and numbing after a while.

Best Practices Learned:

I learned the value of the elephant goldfish model in practice. It helped me catch many potential errors before they were were written into my code. Before this, I did use an agents planning mode and constantly updated their plan before letting it implement. However, running the plan against a fresh goldfish model was something I had never tried before and really helped to flesh out the minor details. This helped me not only understand more about the code it was implementing but also prevented claude from making implementation decisions on the fly.

