Repo and Codebase Organization:

Each frame, p5 calls draw() in Main.ts, it clears the background, applies a uniform scale factor so the game is 800x600. If the window is focused, calls game.update().

GameManager.update() dispatches gameState in STATE.Running, where it does:
1. this.map.update(): moves every sprite, and resolves tile collision.
2. this.inputManager.checkInput(): polls keyIsDown() for each bound keycode, and advances the GameAction based off of the key pressed.
3. this.processActions(): translates the current GameAction state into action calls on the player.

GameMap.update() if the player is DEAD, re-initialize() the level and return. Otherwise, updateSprite(player), then an OOB check, then player.update(deltaTime), then loop over sprites, then updateProjectiles().

- Gravity, X move, Y move are unchanged in shape, but the collision box used throughout getTileCollision, wall/ground snapping now comes from getCollisionWidth()/getCollisionHeight(), not getImage().

- Player-vs-creature/powerup collision checkPlayerCollision is now checked once, after both axes are fully resolved. The new falling signal is player.airborneStreak >= AIRBORNE_ANIM_MIN_STREAK && oldVel.y > 0

checkPlayerCollision() now snapshots every sprite overlapping the player, and branches three ways per Creature hit: dashing kills the creature now unconditionally, falling stomp-kill, and a PowerUp hit from acquirePowerUp().

processActions() vel.x resets every frame, if the fire key isPressed(), and player is NORMAL, player.tryFire(), needs a FireOrb

Abilities:
- Dashing, F key to dash horizontally, can also dash in the air. If dashing (player.isDashing(), a timer set by a prior dash() call): override vel.x with the dash velocity, ignoring normal movement input. Push velocity via setVelocity(). If jump isPressed() and NORMAL: call player.jump(false) (only takes effect if onGround). If dash key isBeginPress() (edge-triggered, not held) and NORMAL: call player.dash(), which starts the dash timer if the cooldown has expired.
- Fire ability: G key to fire, Player gets two independent timers: fireAbilityTimer, and fireCooldownTimer. tryFire() returns true only if the buff is active and the cooldown has expired. spawnProjectile clones a Projectile template resource, and positions it outside player's left/right edge, and gives it a constance horizontal velocity of direction * SPEED with vel.y = 0

Systems:
- Death effects
- getDesiredAnimation() chooses different animation given state
- Non-looping animations
- SoundManager

Load time: ResourceManager.ts + assets.json, preload() to new GameManager() to new ResourceManager("assets/assets.json") to init().

AI Tools Used:

1. Session c83d8734, used for onboarding, understanding the repo structure and what's going on.

2. Session e2146a67, used for fixing the parallax bug.

- Correctly identified the stub (return Math.trunc(offsetX)) as the bug — it wasn't parallaxing at all, just moving in lockstep with the foreground — and read the intended formula out of the test file's own comment. Added a genuine new edge-case test (mapWidth === myW)

3. Session b97d0104, dash ability.

- Correctly walked GameAction's 4-state machine, InputManager.checkInput(), and where GameManager reads it — matches what I verified independently in this conversation.
- Correctly confirmed setVelocity unconditionally overwrites both axes (unlike clamped addVelocity), and flagged the real constraint that mattered: processActions() recomputes vel.x from scratch every frame, which is exactly why dash needed to be asserted after the movement-key branches.
- Implemented, and specifically read tests/Player.test.ts, Creature.test.ts, GameAction.test.ts, and the test mocks before writing new tests — so the new tests matched existing conventions rather than inventing a new pattern. Ran tsc --noEmit and the test suite before calling it done.
- Ran format:check and lint, correctly distinguished pre-existing lint errors in GameMap.ts (out of scope, left alone) from anything introduced by the dash work (clean). Delivered exactly the 3 commits requested, in the requested order, with git diff --staged shown before each, then pushed.

4. Session 141abc5f, frame-trace walkthrough.

- Read all 8 relevant source files plus assets.json/resources.json before answering, and the call-order claims (map.update() → checkInput() → processActions(), axis-separated X-then-Y collision, camera clamping) are verifiable against the actual source line-by-line.

Best Practices Learned:
- Using claude to enhance prompting strategies before feeding the prompt to the coding agent. So refine the prompt for claude by providing the context to another claude session, and having it write the prompt for the claude doing the coding.
- Verifying the commits before pushing. Check whether the commit I am making is correct, and is the version that I want to push to main.
- Test it myself to check for edge cases that is potentially not able to be understood by claude because it does not have reference to the interface of the game, and the game itself.