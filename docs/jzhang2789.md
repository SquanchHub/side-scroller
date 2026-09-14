Repo and Codebase Organization:

Every frame, p5 calls draw() in Main.ts where it clears the background, applies a uniform scale factor so the 800x600 game fits the actual canvas, then if the window is focused, calls game.update().

The GameManager.update() in GameManager.ts dispatches gameState in STATE.Running, in the order:
1. this.map.update(): moves every sprite and resolves collisions
2. this.inputManager.checkInput(): polls keyIsDown() for each bound keycode, and advances the key's GameAction state machine
3. this.processActions(): translates now-current GameAction states into action calls on the player

Because map.update() runs before checkInput() and processActions(), this frame's physics used last frame's velocity. A key pressed now takes effect next frame — a one-frame input latency built into the loop's shape.

If the player is dead, just re-initialize() the level, otherwise, updateSprite(player), then player.update(deltaTime), then loop over sprites.

updateSprite() resolves X first then Y within each tile-collision check. Separating the axes is what lets the player slide along a wall while falling, instead of a diagonal collision stopping both directions at once.

1. Gravity: if !s.isFlying(), add GRAVITY * deltaTime to velocity.y.
2. X move: tentatively add velocity.x * deltaTime to position. Call getTileCollision() against that new position.
3. Y move: same pattern, and tentatively apply velocity.y * deltaTime, check tile collision, snap to the tile's top/bottom edge, call collideVertical()

In GameManager, processAction():
processActions() — GameManager.ts:112:

- Reset vel.x = 0 each frame (horizontal velocity doesn't persist — only vertical/gravity does).
If right/left held and player is NORMAL: set vel.x to ±maxSpeed. This is why my dash couldn't work the way jump does. Jump writes vel.y once and it persists, since nothing resets it. vel.x is rebuilt from zero every frame, so a one-shot setVelocity would be overwritten immediately. The dash needed an override branch in processActions() itself, placed after the movement-key checks so a held arrow key can't fight it.
- If dashing (player.isDashing(), a timer set by a prior dash() call): override vel.x with the dash velocity, ignoring normal movement input.
- Push velocity via setVelocity().
- If jump isPressed() and NORMAL: call player.jump(false) (only takes effect if onGround).
- If dash key isBeginPress() (edge-triggered, not held) and NORMAL: call player.dash(), which starts the dash timer if the cooldown has expired.

GameManager.draw()
- Compute a camera offsetX that centers the player horizontally.
- Draw parallax background layers through computeParallaxX().
- Draw only the visible tile column range from (firstTileX to lastTileX)
- Draw the player image at its screen position.
- Draw every sprite in sprites, and for any Creature currently within the visible screen band, call sprite.wakeUp().

Load time: ResourceManager.ts + assets.json
From preload() -> new GameManager() -> new ResourceManager("assets/assets.json") -> init()

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
- Using claude to enhance prompting strategies before feeding the prompt to the coding agent.
- Verifying the commits before pushing.