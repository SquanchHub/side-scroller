import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameManager, STATE } from "../src/GameManager";
import type { Settings } from "../src/Settings";

// See tests/GameManager.processActions.test.ts for why the real constructor
// can't be used in Node (it touches p5 globals via Settings/ResourceManager).
// toggleMenu() only reads/writes gameState/oldState and calls
// settings.showMenu()/hideMenu(), so hand-wire just those.
function makeGameManager(initialState: STATE): { gm: GameManager; settings: Settings } {
    const gm = Object.create(GameManager.prototype) as GameManager;
    const settings = { showMenu: vi.fn(), hideMenu: vi.fn() } as unknown as Settings;
    gm.settings = settings;
    gm.gameState = initialState;
    gm.oldState = initialState;
    return { gm, settings };
}

describe("GameManager.toggleMenu()", () => {
    let gm: GameManager;
    let settings: Settings;

    beforeEach(() => {
        ({ gm, settings } = makeGameManager(STATE.Loading));
    });

    it("is a no-op while the game is still loading (map does not exist yet)", () => {
        gm.toggleMenu();
        expect(gm.gameState).toBe(STATE.Loading);
        expect(settings.showMenu).not.toHaveBeenCalled();
        expect(settings.hideMenu).not.toHaveBeenCalled();
    });

    it("opens the menu from Running once loading has finished", () => {
        gm.gameState = STATE.Running;
        gm.oldState = STATE.Running;
        gm.toggleMenu();
        expect(gm.gameState).toBe(STATE.Menu);
        expect(settings.showMenu).toHaveBeenCalledOnce();
    });

    it("closes the menu back to the prior state", () => {
        gm.gameState = STATE.Running;
        gm.oldState = STATE.Running;
        gm.toggleMenu(); // open
        gm.toggleMenu(); // close
        expect(gm.gameState).toBe(STATE.Running);
        expect(settings.hideMenu).toHaveBeenCalledOnce();
    });
});
