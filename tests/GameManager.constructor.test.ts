import { describe, it, expect, vi, afterEach } from "vitest";
import { GameManager, STATE } from "../src/GameManager";
import { ResourceManager } from "../src/ResourceManager";
import { InputManager } from "../src/InputManager";
import { SoundManager } from "../src/SoundManager";
import { Settings } from "../src/Settings";
import { GameAction } from "../src/GameAction";

// The real constructor chains into ResourceManager (whose constructor kicks
// off an un-awaited async init() that calls the p5 global loadJSON) and
// Settings (which calls createDiv/createCheckbox at construction time).
// Neither exists in Node, so both are stubbed just enough that construction
// completes without throwing or leaving an unhandled rejection - an empty
// asset manifest is enough for ResourceManager.init() to run its full
// "no resources key" path successfully.
function makeMockElement() {
    const el: Record<string, unknown> = {};
    el.style = vi.fn(() => el);
    el.position = vi.fn(() => el);
    el.child = vi.fn(() => el);
    el.hide = vi.fn(() => el);
    el.show = vi.fn(() => el);
    el.changed = vi.fn(() => el);
    return el;
}

describe("GameManager constructor", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("builds every subsystem (resources, input, sound, settings, actions) and starts in the Loading state", () => {
        vi.stubGlobal("loadJSON", (_rsc: string, success: (v: unknown) => void) => success({}));
        vi.stubGlobal("createDiv", () => makeMockElement());
        vi.stubGlobal("createCheckbox", () => makeMockElement());

        const gm = new GameManager();

        expect(gm.level).toBe(0);
        expect(gm.oldState).toBe(STATE.Loading);
        expect(gm.gameState).toBe(STATE.Loading);
        expect(gm.resources).toBeInstanceOf(ResourceManager);
        expect(gm.inputManager).toBeInstanceOf(InputManager);
        expect(gm.soundManager).toBeInstanceOf(SoundManager);
        expect(gm.settings).toBeInstanceOf(Settings);
        expect(gm.moveRight).toBeInstanceOf(GameAction);
        expect(gm.moveLeft).toBeInstanceOf(GameAction);
        expect(gm.jump).toBeInstanceOf(GameAction);
        expect(gm.dash).toBeInstanceOf(GameAction);
        expect(gm.stop).toBeInstanceOf(GameAction);
        expect(gm.fire).toBeInstanceOf(GameAction);
    });
});
