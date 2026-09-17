import { describe, it, expect, vi } from "vitest";
import { GameManager, STATE } from "../src/GameManager";
import { GameAction } from "../src/GameAction";
import { GameMap } from "../src/GameMap";
import type { ResourceManager } from "../src/ResourceManager";
import type { SoundManager } from "../src/SoundManager";
import type { InputManager } from "../src/InputManager";
import type { Settings } from "../src/Settings";

// See tests/GameManager.processActions.test.ts for why the real constructor
// can't be used in Node.
function makeBareGameManager(): GameManager {
    return Object.create(GameManager.prototype) as GameManager;
}

describe("GameManager.update() - Running state", () => {
    it("delegates to map.update(), polls input, and processes actions each frame", () => {
        const gm = makeBareGameManager();
        gm.gameState = STATE.Running;
        gm.map = { update: vi.fn() } as unknown as GameMap;
        gm.inputManager = { checkInput: vi.fn() } as unknown as InputManager;
        const processSpy = vi.spyOn(gm, "processActions").mockImplementation(() => {});

        gm.update();

        expect(gm.map.update).toHaveBeenCalledOnce();
        expect(gm.inputManager.checkInput).toHaveBeenCalledOnce();
        expect(processSpy).toHaveBeenCalledOnce();
    });
});

describe("GameManager.update() - Menu/Finished states", () => {
    it("Menu: does nothing (gameplay is paused while the menu is open)", () => {
        const gm = makeBareGameManager();
        gm.gameState = STATE.Menu;
        expect(() => gm.update()).not.toThrow();
        expect(gm.gameState).toBe(STATE.Menu);
    });

    it("Finished: does nothing", () => {
        const gm = makeBareGameManager();
        gm.gameState = STATE.Finished;
        expect(() => gm.update()).not.toThrow();
        expect(gm.gameState).toBe(STATE.Finished);
    });

    it("logs an error instead of throwing for an unrecognized state", () => {
        const gm = makeBareGameManager();
        gm.gameState = 999 as STATE;
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => gm.update()).not.toThrow();
        expect(errorSpy).toHaveBeenCalledWith("IMPOSSIBLE STATE IN GAME");
        errorSpy.mockRestore();
    });
});

describe("GameManager.update() - Loading -> Menu transition", () => {
    // update()'s Loading branch reaches directly for p5's arrow-key keyCode
    // constants (RIGHT_ARROW/LEFT_ARROW/UP_ARROW) when wiring up input
    // bindings; nothing in tests/mocks or tests/setup.ts stubs those, so
    // they're stubbed locally.
    function makePlayerTemplate() {
        return {
            clone: () => ({
                setPosition: vi.fn(),
                getImage: () => ({ width: 16, height: 16 }),
            }),
        };
    }

    function makeLoadingGameManager(resourcesLoaded: boolean): GameManager {
        const gm = makeBareGameManager();
        gm.level = 0;
        gm.oldState = STATE.Loading;
        gm.gameState = STATE.Loading;

        const mapLines = ["0"]; // a single-tile map: just the player spawn char
        const resourceValues: Record<string, unknown> = {
            TILE_SIZE: 64,
            mappings: { "0": "player" },
            levels: ["lvl0"],
            player: makePlayerTemplate(),
        };
        gm.resources = {
            isLoaded: () => resourcesLoaded,
            get: (name: string) => resourceValues[name],
            getLoad: vi.fn((name: string) => (name === "lvl0" ? mapLines : { fakeSound: name })),
        } as unknown as ResourceManager;
        gm.soundManager = {
            registerEvent: vi.fn(),
            setMusicQueue: vi.fn(),
        } as unknown as SoundManager;
        gm.inputManager = { setGameAction: vi.fn() } as unknown as InputManager;
        gm.settings = {} as Settings;
        gm.moveRight = new GameAction();
        gm.moveLeft = new GameAction();
        gm.jump = new GameAction();
        gm.dash = new GameAction();
        gm.stop = new GameAction();
        gm.fire = new GameAction();
        return gm;
    }

    it("stays in Loading and builds nothing while resources are still loading", () => {
        const gm = makeLoadingGameManager(false);
        gm.update();
        expect(gm.gameState).toBe(STATE.Loading);
        expect(gm.map).toBeUndefined();
    });

    it("builds the map, registers every sound event, queues the music playlist, binds every input action, and transitions to Menu once resources finish", () => {
        vi.stubGlobal("RIGHT_ARROW", 39);
        vi.stubGlobal("LEFT_ARROW", 37);
        vi.stubGlobal("UP_ARROW", 38);

        const gm = makeLoadingGameManager(true);
        gm.update();

        expect(gm.map).toBeInstanceOf(GameMap);
        expect(gm.gameState).toBe(STATE.Menu);
        expect(gm.oldState).toBe(STATE.Running); // where closing the menu should return to

        for (const name of [
            "prize",
            "boop2",
            "fireHit",
            "heartPickup",
            "fireOrbPickup",
            "fireLaunch",
            "dashSound",
        ]) {
            expect(gm.soundManager.registerEvent).toHaveBeenCalledWith(name, expect.anything());
        }
        expect(gm.soundManager.setMusicQueue).toHaveBeenCalledTimes(1);
        expect(
            (gm.soundManager.setMusicQueue as ReturnType<typeof vi.fn>).mock.calls[0][0]
        ).toHaveLength(6);

        expect(gm.inputManager.setGameAction).toHaveBeenCalledWith(gm.moveRight, 39);
        expect(gm.inputManager.setGameAction).toHaveBeenCalledWith(gm.moveLeft, 37);
        expect(gm.inputManager.setGameAction).toHaveBeenCalledWith(gm.jump, 32);
        expect(gm.inputManager.setGameAction).toHaveBeenCalledWith(gm.dash, 70); // F
        expect(gm.inputManager.setGameAction).toHaveBeenCalledWith(gm.stop, 38);
        expect(gm.inputManager.setGameAction).toHaveBeenCalledWith(gm.fire, 71); // G

        vi.unstubAllGlobals();
    });
});
