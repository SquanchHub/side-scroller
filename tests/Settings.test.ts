import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Settings } from "../src/Settings";
import type { SoundManager } from "../src/SoundManager";

// Settings' constructor and methods are built entirely out of p5 globals
// (createDiv/createCheckbox/min/width/height/fullscreen) that tests/mocks/p5.ts
// and tests/setup.ts don't stub (only createVector/deltaTime are, for Sprite
// physics). None of them exist in Node, so every one is stubbed locally here
// via vi.stubGlobal and torn down after each test.
interface MockElement {
    style: ReturnType<typeof vi.fn>;
    position: ReturnType<typeof vi.fn>;
    child: ReturnType<typeof vi.fn>;
    hide: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    size: ReturnType<typeof vi.fn>;
    changed: ReturnType<typeof vi.fn>;
    label?: string;
    checked?: boolean;
    triggerChanged: () => void;
}

function makeElement(): MockElement {
    const el = {} as MockElement;
    let changedCb: () => void = () => {};
    el.style = vi.fn(() => el);
    el.position = vi.fn(() => el);
    el.child = vi.fn(() => el);
    el.hide = vi.fn(() => el);
    el.show = vi.fn(() => el);
    el.size = vi.fn(() => el);
    el.changed = vi.fn((cb: () => void) => {
        changedCb = cb;
        return el;
    });
    el.triggerChanged = () => changedCb();
    return el;
}

describe("Settings", () => {
    let createdDivs: MockElement[];
    let createdCheckboxes: MockElement[];
    let soundManager: SoundManager;

    beforeEach(() => {
        createdDivs = [];
        createdCheckboxes = [];
        vi.stubGlobal("createDiv", (html?: string) => {
            const el = makeElement();
            (el as unknown as { html?: string }).html = html;
            createdDivs.push(el);
            return el;
        });
        vi.stubGlobal("createCheckbox", (label: string, checked: boolean) => {
            const el = makeElement();
            el.label = label;
            el.checked = checked;
            createdCheckboxes.push(el);
            return el;
        });
        vi.stubGlobal("min", (a: number, b: number) => Math.min(a, b));
        vi.stubGlobal("width", 800);
        vi.stubGlobal("height", 600);
        soundManager = {
            playMusic: false,
            playEvents: true,
            toggleMusic: vi.fn(),
            toggleEvents: vi.fn(),
        } as unknown as SoundManager;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("builds a hidden menu div containing the instructions, and starts hidden", () => {
        new Settings(soundManager);
        expect(createdDivs).toHaveLength(2); // menu, then instructions
        const [menu, instructions] = createdDivs;
        expect(menu.child).toHaveBeenCalledWith(instructions);
        expect(menu.hide).toHaveBeenCalledOnce();
    });

    it("wires the music and event checkboxes to the sound manager's toggles", () => {
        new Settings(soundManager);
        const [musicBox, eventsBox] = createdCheckboxes;
        expect(musicBox.label).toBe("Play Music");
        expect(musicBox.checked).toBe(soundManager.playMusic);
        expect(eventsBox.label).toBe("Play Event Sounds");
        expect(eventsBox.checked).toBe(soundManager.playEvents);

        musicBox.triggerChanged();
        expect(soundManager.toggleMusic).toHaveBeenCalledOnce();

        eventsBox.triggerChanged();
        expect(soundManager.toggleEvents).toHaveBeenCalledOnce();
    });

    it("wires the fullscreen checkbox to toggleFullScreen()", () => {
        const fullscreenMock = vi.fn(() => false);
        vi.stubGlobal("fullscreen", fullscreenMock);
        new Settings(soundManager);
        const fullBox = createdCheckboxes[2];
        expect(fullBox.label).toBe("Full Screen");

        fullBox.triggerChanged();
        expect(fullscreenMock).toHaveBeenCalledWith(true);
    });

    it("showMenu() scales the menu to fit the smaller of the width/height ratios, then shows it", () => {
        const settings = new Settings(soundManager);
        const menu = createdDivs[0];
        settings.showMenu();
        // scaleFactor = min(800/800, 600/600) = 1
        expect(menu.size).toHaveBeenCalledWith(800 * 1 - 60, 600 * 1 - 60);
        expect(menu.show).toHaveBeenCalledOnce();
    });

    it("showMenu() picks the smaller ratio when the window isn't 4:3", () => {
        vi.stubGlobal("width", 400); // half width -> width ratio (0.5) is the smaller one
        const settings = new Settings(soundManager);
        const menu = createdDivs[0];
        settings.showMenu();
        expect(menu.size).toHaveBeenCalledWith(800 * 0.5 - 60, 600 * 0.5 - 60);
    });

    it("hideMenu() hides the menu", () => {
        const settings = new Settings(soundManager);
        const menu = createdDivs[0];
        settings.hideMenu();
        expect(menu.hide).toHaveBeenCalledTimes(2); // once at construction, once here
    });

    it("toggleFullScreen() flips whatever the current fullscreen state is", () => {
        let state = false;
        const fullscreenMock = vi.fn((val?: boolean) => {
            if (val === undefined) return state;
            state = val;
            return state;
        });
        vi.stubGlobal("fullscreen", fullscreenMock);
        const settings = new Settings(soundManager);

        settings.toggleFullScreen();
        expect(fullscreenMock).toHaveBeenLastCalledWith(true);

        settings.toggleFullScreen();
        expect(fullscreenMock).toHaveBeenLastCalledWith(false);
    });
});
