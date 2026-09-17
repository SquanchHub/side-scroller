import { describe, it, expect, vi } from "vitest";
import { ResourceManager } from "../src/ResourceManager";
import { Star } from "../src/sprites/PowerUp";

// init() orchestrates loadResource() calls (loading the top-level asset
// manifest, then every asset it lists, then building `resources` out of the
// loaded "resources" entry) but never touches p5 globals directly itself -
// only loadResource() does. So it's tested here by spying on the instance's
// own loadResource() and having it resolve/reject with controlled fake data,
// rather than stubbing every p5 loader global it might delegate to.
function makeManager(responses: Record<string, unknown>): ResourceManager {
    const rm = Object.create(ResourceManager.prototype) as ResourceManager;
    rm.everythingLoaded = false;
    rm.loads = {};
    rm.resources = {};
    vi.spyOn(rm, "loadResource").mockImplementation((rsc: string) => {
        if (!(rsc in responses)) {
            return Promise.reject(`no fake response configured for "${rsc}"`);
        }
        return Promise.resolve(responses[rsc]);
    });
    return rm;
}

describe("ResourceManager.init() - full happy path", () => {
    it("loads every listed asset, copies over images/maps, builds sprites, and ignores sounds, then marks everything loaded", async () => {
        const starImg = { width: 8, height: 8 };
        const rm = makeManager({
            "assets.json": {
                json: { resources: "resources.json" },
                image: { starSheet: "images/star.png" },
            },
            "resources.json": {
                images: { star1: "starSheet" },
                maps: { TILE_SIZE: 64, mappings: { o: "star" }, levels: ["map1"] },
                sounds: { blip: "blipLoad" },
                sprites: {
                    star: { type: "Star", default: [{ img: "starSheet", duration: 150 }] },
                },
            },
            "images/star.png": starImg,
        });

        await rm.init("assets.json");

        expect(rm.everythingLoaded).toBe(true);
        expect(rm.resources.star1).toBe(starImg); // "images" entries copied straight over
        expect(rm.resources.TILE_SIZE).toBe(64); // "maps" entries copied straight over
        expect(rm.resources.mappings).toEqual({ o: "star" });
        expect(rm.resources.levels).toEqual(["map1"]);
        expect(rm.resources.star).toBeInstanceOf(Star); // "sprites" entries built via buildSprite()
        expect(rm.resources.blip).toBeUndefined(); // "sounds" entries are intentionally a no-op for now
    });

    it("warns but still finishes loading when the loaded assets have no top-level 'resources' entry", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const rm = makeManager({
            "assets.json": { image: { logo: "images/logo.png" } },
            "images/logo.png": { width: 4, height: 4 },
        });

        await rm.init("assets.json");

        expect(warnSpy).toHaveBeenCalledWith(
            "Loaded Assets but no resources key so no resources will be built"
        );
        expect(rm.everythingLoaded).toBe(true);
        expect(rm.resources).toEqual({});
        warnSpy.mockRestore();
    });

    it("warns on an unrecognized resource-type key instead of failing the whole load", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const rm = makeManager({
            "assets.json": { json: { resources: "resources.json" } },
            "resources.json": { widgets: { foo: "bar" } },
        });

        await rm.init("assets.json");

        expect(warnSpy).toHaveBeenCalledWith("Unknown Resource Type:", "widgets");
        expect(rm.everythingLoaded).toBe(true);
        warnSpy.mockRestore();
    });
});

describe("ResourceManager.init() - failure paths", () => {
    it("rejects with a descriptive error when the top-level asset manifest itself fails to load", async () => {
        const rm = Object.create(ResourceManager.prototype) as ResourceManager;
        rm.everythingLoaded = false;
        rm.loads = {};
        rm.resources = {};
        vi.spyOn(rm, "loadResource").mockRejectedValue("network error");

        await expect(rm.init("assets.json")).rejects.toThrow(
            "Unable To Load Asset File: assets.json"
        );
    });

    it("rejects with a descriptive error when one of the listed assets fails to load", async () => {
        const rm = Object.create(ResourceManager.prototype) as ResourceManager;
        rm.everythingLoaded = false;
        rm.loads = {};
        rm.resources = {};
        vi.spyOn(rm, "loadResource").mockImplementation((rsc: string) => {
            if (rsc === "assets.json") {
                return Promise.resolve({ image: { broken: "images/missing.png" } });
            }
            return Promise.reject("failed to load images/missing.png");
        });

        await expect(rm.init("assets.json")).rejects.toThrow("Failed in loading assets");
    });
});
