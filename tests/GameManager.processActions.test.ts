import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameManager } from "../src/GameManager";
import { GameAction } from "../src/GameAction";
import { Player } from "../src/sprites/Player";
import type { GameMap } from "../src/GameMap";
import type { SoundManager } from "../src/SoundManager";

// GameManager's real constructor is not usable in Node: it builds a Settings
// (which calls the p5 globals createDiv/createCheckbox at construction time)
// and a ResourceManager (whose constructor kicks off an un-awaited init() that
// calls the p5 global loadJSON). None of those exist outside a browser/p5
// sketch, and tests/mocks/p5.ts only stubs createVector/deltaTime, so `new
// GameManager()` throws before it finishes.
//
// processActions() only ever reads this.map.player, the five GameAction
// fields (moveRight/moveLeft/jump/dash/stop/fire), and this.soundManager -
// none of which have a p5 dependency of their own. So instead of going
// through the constructor, build the instance with
// Object.create(GameManager.prototype) and hand-wire just those fields.
function makeGameManager(player: Player): GameManager {
    const gm = Object.create(GameManager.prototype) as GameManager;
    gm.moveRight = new GameAction();
    gm.moveLeft = new GameAction();
    gm.jump = new GameAction();
    gm.dash = new GameAction();
    gm.stop = new GameAction();
    gm.fire = new GameAction();
    gm.soundManager = { playEvent: vi.fn() } as unknown as SoundManager;
    gm.map = { player } as GameMap;
    return gm;
}

describe("GameManager.processActions() dash override", () => {
    let player: Player;
    let gm: GameManager;

    beforeEach(() => {
        player = new Player();
        gm = makeGameManager(player);
    });

    it("dash velocity overrides a held movement key while dashing", () => {
        // Frame 1: moveRight held, dash begins. isDashing() is still false
        // going into this frame's vel.x computation (player.dash() only runs
        // at the end of processActions()), so vel.x is just maxSpeed here.
        gm.moveRight.press();
        gm.dash.press();
        gm.processActions();
        expect(player.getVelocity().x).toBe(player.MAX_SPEED);
        expect(player.isDashing()).toBe(true);

        // Frame 2: moveRight still held, dash key held (no longer a begin-press).
        // Without the isDashing() override, vel.x would just be maxSpeed again.
        gm.moveRight.press();
        gm.dash.press();
        gm.processActions();
        expect(player.getVelocity().x).toBe(player.getDashVelocityX());
        expect(player.getVelocity().x).not.toBe(player.MAX_SPEED);
    });

    it("control returns to normal movement speed once the dash expires", () => {
        gm.dash.press();
        gm.processActions(); // starts the dash
        expect(player.isDashing()).toBe(true);

        player.update(player.DASH_DURATION); // let the dash burst run out
        expect(player.isDashing()).toBe(false);

        gm.moveRight.press();
        gm.processActions();
        expect(player.getVelocity().x).toBe(player.MAX_SPEED);
    });

    it("vel.y is untouched by the dash branch", () => {
        player.addVelocity(0, 0.3); // simulate gravity/fall speed
        gm.dash.press();
        gm.processActions();
        expect(player.isDashing()).toBe(true);
        expect(player.getVelocity().y).toBeCloseTo(0.3);
    });

    it("plays the dashSound event on a successful trigger, but not on a cooldown-blocked retrigger", () => {
        gm.dash.press(); // BEGIN_PRESS
        gm.processActions(); // starts the dash
        expect(player.isDashing()).toBe(true);
        expect(gm.soundManager.playEvent).toHaveBeenCalledWith("dashSound");
        expect(gm.soundManager.playEvent).toHaveBeenCalledTimes(1);

        gm.dash.release(); // PRESSED -> END_PRESS
        gm.dash.press(); // END_PRESS -> BEGIN_PRESS again (a quick re-tap)
        gm.processActions(); // still on cooldown - dash() returns false, blocked
        expect(gm.soundManager.playEvent).toHaveBeenCalledTimes(1); // no additional play
    });
});
