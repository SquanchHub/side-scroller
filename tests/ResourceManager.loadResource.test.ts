import { describe, it, expect, vi, afterEach } from "vitest";
import { ResourceManager } from "../src/ResourceManager";

describe("ResourceManager constructor", () => {
    it("initializes empty loads/resources, starts not-loaded, and kicks off init() with the given asset file", () => {
        const initSpy = vi.spyOn(ResourceManager.prototype, "init").mockResolvedValue(undefined);

        const rm = new ResourceManager("assets/assets.json");

        expect(rm.everythingLoaded).toBe(false);
        expect(rm.loads).toEqual({});
        expect(rm.resources).toEqual({});
        expect(initSpy).toHaveBeenCalledWith("assets/assets.json");

        initSpy.mockRestore();
    });
});

describe("ResourceManager - trivial accessors", () => {
    function makeManager(): ResourceManager {
        const rm = Object.create(ResourceManager.prototype) as ResourceManager;
        rm.everythingLoaded = false;
        rm.loads = { rawSound: { id: "raw" } };
        rm.resources = { star: { id: "star-resource" } };
        return rm;
    }

    it("isLoaded() reflects everythingLoaded", () => {
        const rm = makeManager();
        expect(rm.isLoaded()).toBe(false);
        rm.everythingLoaded = true;
        expect(rm.isLoaded()).toBe(true);
    });

    it("get() reads from resources, getLoad() reads from loads", () => {
        const rm = makeManager();
        expect(rm.get("star")).toEqual({ id: "star-resource" });
        expect(rm.get("nope")).toBeUndefined();
        expect(rm.getLoad("rawSound")).toEqual({ id: "raw" });
    });

    it("listResources() lists the built resource names, not the raw loads", () => {
        const rm = makeManager();
        expect(rm.listResources()).toEqual(["star"]);
    });
});

// loadResource() is the only place any p5 loader global (loadImage/loadStrings/
// loadJSON/loadSound/httpGet) is actually called; each is stubbed only for the
// test(s) that need it.
describe("ResourceManager.loadResource()", () => {
    const rm = Object.create(ResourceManager.prototype) as ResourceManager;

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("'image' and 'spritesheet' both resolve via loadImage()", async () => {
        const fakeImg = { width: 4, height: 4 };
        vi.stubGlobal("loadImage", (rsc: string, success: (v: unknown) => void) =>
            success({ ...fakeImg, rsc })
        );
        await expect(rm.loadResource("a.png", "image")).resolves.toEqual({
            ...fakeImg,
            rsc: "a.png",
        });
        await expect(rm.loadResource("b.png", "spritesheet")).resolves.toEqual({
            ...fakeImg,
            rsc: "b.png",
        });
    });

    it("'image' rejects when loadImage() fails", async () => {
        vi.stubGlobal("loadImage", (_rsc: string, _success: unknown, failure: () => void) =>
            failure()
        );
        await expect(rm.loadResource("missing.png", "image")).rejects.toBe(
            "failed to load missing.png"
        );
    });

    it("'text' resolves via loadStrings()", async () => {
        vi.stubGlobal("loadStrings", (_rsc: string, success: (v: unknown) => void) =>
            success(["a", "b"])
        );
        await expect(rm.loadResource("map1.txt", "text")).resolves.toEqual(["a", "b"]);
    });

    it("'json' resolves via loadJSON()", async () => {
        vi.stubGlobal("loadJSON", (_rsc: string, success: (v: unknown) => void) =>
            success({ ok: true })
        );
        await expect(rm.loadResource("resources.json", "json")).resolves.toEqual({ ok: true });
    });

    it("'sound' resolves via loadSound()", async () => {
        const fakeSound = { play: vi.fn() };
        vi.stubGlobal("loadSound", (_rsc: string, success: (v: unknown) => void) =>
            success(fakeSound)
        );
        await expect(rm.loadResource("blip.mp3", "sound")).resolves.toBe(fakeSound);
    });

    it("'get' resolves via httpGet()", async () => {
        vi.stubGlobal("httpGet", (_rsc: string, success: (v: unknown) => void) => success("pong"));
        await expect(rm.loadResource("http://x/ping", "get")).resolves.toBe("pong");
    });

    it("rejects immediately for an unrecognized resource type, without calling any loader", async () => {
        await expect(rm.loadResource("whatever", "carrier-pigeon")).rejects.toBe(
            "invalid type of resource: carrier-pigeon"
        );
    });
});
