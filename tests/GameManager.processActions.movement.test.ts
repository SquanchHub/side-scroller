import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameManager } from "../src/GameManager";
import { GameAction } from "../src/GameAction";
import { Player } from "../src/sprites/Player";
import { CreatureState } from "../src/sprites/Creature";
import type { GameMap } from "../src/GameMap";
import type { SoundManager } from "../src/SoundManager";

// See tests/GameManager.processActions.test.ts for why the real constructor
// can't be used in Node, and for the field list processActions() reads.
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

describe("GameManager.processActions() basic movement", () => {
    let player: Player;
    let gm: GameManager;

    beforeEach(() => {
        player = new Player();
        gm = makeGameManager(player);
    });

    it("moveRight sets vel.x to the player's max speed", () => {
        gm.moveRight.press();
        gm.processActions();
        expect(player.getVelocity().x).toBe(player.getMaxSpeed());
    });

    it("moveLeft sets vel.x to negative max speed", () => {
        gm.moveLeft.press();
        gm.processActions();
        expect(player.getVelocity().x).toBe(-player.getMaxSpeed());
    });

    it("vel.x is reset to 0 each frame when no movement key is held", () => {
        gm.processActions();
        expect(player.getVelocity().x).toBe(0);
    });

    it("vel.x returns to 0 once a held key is fully released (through its END_PRESS frame)", () => {
        gm.moveRight.press(); // RELEASED -> BEGIN_PRESS
        gm.processActions();
        expect(player.getVelocity().x).not.toBe(0);

        gm.moveRight.release(); // BEGIN_PRESS -> END_PRESS (isPressed() still true this frame)
        gm.processActions();
        expect(player.getVelocity().x).not.toBe(0);

        gm.moveRight.release(); // END_PRESS -> RELEASED
        gm.processActions();
        expect(player.getVelocity().x).toBe(0);
    });

    it("movement keys are ignored while the player is not NORMAL (e.g. mid-death)", () => {
        player.setState(CreatureState.DYING);
        gm.moveRight.press();
        gm.processActions();
        expect(player.getVelocity().x).toBe(0);
    });

    it("jump.isBeginPress() triggers a ground jump via player.jump(false)", () => {
        player.onGround = true;
        gm.jump.press(); // BEGIN_PRESS on the very first read
        gm.processActions();
        expect(player.getVelocity().y).toBe(-player.JUMP_SPEED);
        expect(player.onGround).toBe(false);
    });

    it("holding jump does not repeatedly trigger it - only the initial begin-press does", () => {
        player.onGround = true;
        gm.jump.press();
        gm.processActions(); // consumes the begin-press, player leaves the ground
        player.onGround = true; // simulate landing again on the same held frame
        player.setVelocity(0, 0);

        gm.jump.press(); // still held: PRESSED -> PRESSED, not a new begin-press
        gm.processActions();
        expect(player.getVelocity().y).toBe(0); // no second jump triggered
    });

    it("jump is ignored while the player is not NORMAL", () => {
        player.setState(CreatureState.DYING);
        player.onGround = true;
        gm.jump.press();
        gm.processActions();
        expect(player.getVelocity().y).toBe(0);
    });
});
