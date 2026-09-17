import { describe, it, expect, vi } from "vitest";
import { GameManager, STATE } from "../src/GameManager";
import type { GameMap } from "../src/GameMap";
import type { Settings } from "../src/Settings";

// See tests/GameManager.processActions.test.ts for why the real constructor
// can't be used in Node. draw() only reads gameState/map/settings, so those
// are the only fields hand-wired here.
function makeGameManager(state: STATE): GameManager {
    const gm = Object.create(GameManager.prototype) as GameManager;
    gm.gameState = state;
    return gm;
}

describe("GameManager.draw()", () => {
    it("Running: draws the map", () => {
        const gm = makeGameManager(STATE.Running);
        gm.map = { draw: vi.fn() } as unknown as GameMap;
        gm.draw();
        expect(gm.map.draw).toHaveBeenCalledOnce();
    });

    it("Menu: draws the map underneath and shows the settings overlay on top", () => {
        const gm = makeGameManager(STATE.Menu);
        gm.map = { draw: vi.fn() } as unknown as GameMap;
        gm.settings = { showMenu: vi.fn() } as unknown as Settings;
        gm.draw();
        expect(gm.map.draw).toHaveBeenCalledOnce();
        expect(gm.settings.showMenu).toHaveBeenCalledOnce();
    });

    it("Loading: does nothing (the map doesn't exist yet)", () => {
        const gm = makeGameManager(STATE.Loading);
        expect(() => gm.draw()).not.toThrow();
    });

    it("Finished: does nothing", () => {
        const gm = makeGameManager(STATE.Finished);
        expect(() => gm.draw()).not.toThrow();
    });

    it("logs an error instead of throwing for an unrecognized state", () => {
        const gm = makeGameManager(999 as STATE);
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => gm.draw()).not.toThrow();
        expect(errorSpy).toHaveBeenCalledWith("IMPOSSIBLE STATE IN GAME");
        errorSpy.mockRestore();
    });
});
