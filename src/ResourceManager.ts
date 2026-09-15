import { Player } from "./sprites/Player.js";
import { Fly, Grub, Creature } from "./sprites/Creature.js";
import { FireOrb, Heart, Music, PowerUp, Star } from "./sprites/PowerUp.js";
import { Projectile } from "./sprites/Projectile.js";
import { Sprite } from "./sprites/Sprite.js";
import { Explosion } from "./sprites/Explosion.js";

export class ResourceManager {
    assets: object;
    loads: { [key: string]: any };
    resources: { [key: string]: any };
    everythingLoaded: boolean;

    constructor(f: string) {
        this.everythingLoaded = false;
        this.loads = {};
        this.resources = {};
        this.init(f);
    }

    /**
     * Initializes all the fields by loading the asset file from the given parameter,
     * Then loading all of the assets and storing them in loads
     * and then building resources from those loads.  This function await's for all
     * assets to be loaded and resources built.
     */
    async init(f: string) {
        const promise = this.loadResource(f, "json");
        await promise
            .then((value) => {
                this.assets = value as object;
            })
            .catch(() => {
                throw new Error("Unable To Load Asset File: " + f);
            });
        //now load all the assets at the same time
        const loadPromises = [];
        const loadNames = [];
        for (const loadType in this.assets) {
            if (Object.prototype.hasOwnProperty.call(this.assets, loadType)) {
                const loadsForType = this.assets[loadType];
                for (const loadName in loadsForType) {
                    if (Object.prototype.hasOwnProperty.call(loadsForType, loadName)) {
                        const element = loadsForType[loadName];
                        loadPromises.push(this.loadResource(element, loadType));
                        loadNames.push(loadName);
                    }
                }
            }
        }
        //when they are loaded store them into loads
        await Promise.all(loadPromises)
            .then((values) => {
                for (let index = 0; index < values.length; index++) {
                    this.loads[loadNames[index]] = values[index];
                }
            })
            .catch((value) => {
                throw new Error("Failed in loading assets " + value);
            });
        //^^^^^^^^^^^^^^^^^^^^^^ Done Getting the assets loaded ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        //vvvvvvvvvvvvvvvvvvvvvv Now Construct Resources from the Loaded Assets vvvvvvvvvvvvvvvvvvvvvvv
        //now look for a resources key and process each key in it in order to build up resources
        //for the game.
        if (Object.prototype.hasOwnProperty.call(this.loads, "resources")) {
            for (const resourceType in this.loads["resources"]) {
                if (Object.prototype.hasOwnProperty.call(this.loads["resources"], resourceType)) {
                    const resources = this.loads["resources"][resourceType];
                    switch (resourceType) {
                        case "images": {
                            //just copy them over to the resources with the given name
                            for (const resourceName in resources) {
                                if (Object.prototype.hasOwnProperty.call(resources, resourceName)) {
                                    const loadName = resources[resourceName];
                                    this.resources[resourceName] = this.loads[loadName];
                                }
                            }
                            break;
                        }
                        case "maps": {
                            //store the mappings and levels as resources.
                            for (const key in resources) {
                                if (Object.prototype.hasOwnProperty.call(resources, key)) {
                                    this.resources[key] = resources[key];
                                }
                            }
                            break;
                        }
                        case "sounds": {
                            //don't do anything with sounds yet
                            break;
                        }
                        case "sprites": {
                            //create each sprite
                            for (const spriteName in resources) {
                                if (Object.prototype.hasOwnProperty.call(resources, spriteName)) {
                                    const buildProcess = resources[spriteName];
                                    const spriteType = buildProcess["type"];
                                    delete buildProcess["type"];
                                    this.resources[spriteName] = this.buildSprite(
                                        spriteName,
                                        buildProcess,
                                        spriteType
                                    );
                                }
                            }
                            break;
                        }
                        default: {
                            console.warn("Unknown Resource Type:", resourceType);
                        }
                    }
                }
            }
        } else {
            console.warn("Loaded Assets but no resources key so no resources will be built");
        }
        this.everythingLoaded = true;
    }

    buildSprite(spriteName: string, anims: any, spriteType: string): Sprite {
        let first = true;
        let s;
        switch (spriteType) {
            case "Player": {
                s = new Player();
                break;
            }
            case "Creature": {
                s = new Creature();
                break;
            }
            case "Sprite": {
                s = new Sprite();
                break;
            }
            case "Grub": {
                s = new Grub();
                break;
            }
            case "Fly": {
                s = new Fly();
                break;
            }
            case "Heart": {
                s = new Heart();
                break;
            }
            case "PowerUp": {
                s = new PowerUp();
                break;
            }
            case "Star": {
                s = new Star();
                break;
            }
            case "Music": {
                s = new Music();
                break;
            }
            case "Explosion": {
                s = new Explosion();
                break;
            }
            case "FireOrb": {
                s = new FireOrb();
                break;
            }
            case "Projectile": {
                s = new Projectile();
                break;
            }
            default: {
                console.error("No Sprite Type:", spriteType);
                throw new Error();
            }
        }
        // Some art has empty margin below its feet within its frame, so
        // nudge only these named sprites down at draw time (see
        // Sprite.drawOffsetY) rather than baking an offset into the image
        // files.
        if (spriteName === "player") {
            s.drawOffsetY = 3;
        } else if (spriteName === "caveman") {
            s.drawOffsetY = 3;
        } else if (spriteName === "grub") {
            s.drawOffsetY = 3;
        }
        // "player" and "caveman" disappear on death and spawn a separate
        // explosion effect in their place instead (see GameMap and
        // Creature.explodesOnDeath). "grub" and "fly" instead spawn a
        // bugjuice splat alongside themselves -- they keep falling/tumbling
        // through their own death animation unchanged (explodesOnDeath
        // stays false for them).
        if (spriteName === "player" || spriteName === "caveman") {
            (s as Creature).deathEffect = "explosion";
            (s as Creature).explodesOnDeath = true;
        } else if (spriteName === "grub" || spriteName === "fly") {
            (s as Creature).deathEffect = "bugjuice";
        }
        for (const animName in anims) {
            if (Object.prototype.hasOwnProperty.call(anims, animName)) {
                const frames = anims[animName];
                s.addAnimation(animName);
                if (first) {
                    s.setAnimation(animName);
                    first = false;
                }
                frames.forEach((frame) => {
                    let images;
                    if (Object.prototype.hasOwnProperty.call(frame, "sheet")) {
                        const startImg = this.loads[frame.sheet];
                        images = this.divideUpImage(startImg, frame.rows, frame.cols);
                    } else {
                        images = [this.loads[frame.img]]; //just a single image but keep as a list
                    }
                    images.forEach((img) => {
                        if (Object.prototype.hasOwnProperty.call(frame, "operators")) {
                            frame["operators"].forEach((operator) => {
                                switch (operator) {
                                    case "mirror": {
                                        img = this.mirror(img);
                                        break;
                                    }
                                    case "flip": {
                                        img = this.flip(img);
                                        break;
                                    }
                                    default: {
                                        console.warn(
                                            "Invalid Operation for Sprite ",
                                            spriteName,
                                            ":",
                                            operator,
                                            "- skipping frame for animation",
                                            animName
                                        );
                                        break;
                                    }
                                }
                            });
                        }
                        s.addFrame(animName, img, frame.duration);
                    });
                });
            }
        }
        return s;
    }

    divideUpImage(img: p5.Image, rows: number, cols: number): p5.Image[] {
        const images: p5.Image[] = [];
        const canvas = createGraphics(img.width / cols, img.height / rows);
        // Force density 1 so canvas.get() below returns images whose .pixels
        // array is exactly width*height*4 (matching a normal loadImage()'d
        // PNG). Without this, on a HiDPI display the buffer inherits the
        // sketch's real pixel density, and mirror()/flip() -- which index
        // .pixels using only the logical width/height -- read/write
        // completely wrong offsets, producing visible pixel noise. Every
        // other sprite only ever runs mirror()/flip() on loadImage() output
        // (already density 1), so this path is the only one affected.
        canvas.pixelDensity(1);
        for (let rowIndex = 0; rowIndex < img.height; rowIndex += img.height / rows) {
            for (let colIndex = 0; colIndex < img.width; colIndex += img.width / cols) {
                canvas.image(
                    img,
                    0,
                    0,
                    img.width / cols,
                    img.height / rows,
                    colIndex,
                    rowIndex,
                    img.width / cols,
                    img.height / rows
                );
                images.push(canvas.get());
                canvas.clear();
            }
        }
        return images;
    }

    /**
     * Returns true when all resources requested have been loaded and built.
     */
    isLoaded(): boolean {
        return this.everythingLoaded;
    }

    /**
     * Loads the resource from the provided location (file or URL).  Returns a Promise.
     * @param rsc -- The file or URL to be loaded
     * @param t -- The type of the resource.  Valid types: image, text, json, get(performs HTTP get request)
     */
    loadResource(rsc: string, t: string): Promise<unknown> {
        return new Promise((resolve, reject) => {
            switch (t) {
                case "spritesheet": {
                    loadImage(
                        rsc,
                        (img) => {
                            resolve(img);
                        },
                        () => {
                            reject("failed to load " + rsc);
                        }
                    );
                    break;
                }
                case "image": {
                    loadImage(
                        rsc,
                        (img) => {
                            resolve(img);
                        },
                        () => {
                            reject("failed to load " + rsc);
                        }
                    );
                    break;
                }
                case "text": {
                    loadStrings(
                        rsc,
                        (txt) => {
                            resolve(txt);
                        },
                        () => {
                            reject("failed to load " + rsc);
                        }
                    );
                    break;
                }
                case "json": {
                    loadJSON(
                        rsc,
                        (j) => {
                            resolve(j);
                        },
                        () => {
                            reject("failed to load " + rsc);
                        }
                    );
                    break;
                }
                case "sound": {
                    loadSound(
                        rsc,
                        (j) => {
                            resolve(j);
                        },
                        () => {
                            reject("failed to load " + rsc);
                        }
                    );
                    break;
                }
                case "get": {
                    httpGet(
                        rsc,
                        (j) => {
                            resolve(j);
                        },
                        () => {
                            reject("failed to load " + rsc);
                        }
                    );
                    break;
                }
                default: {
                    reject("invalid type of resource: " + t);
                    break;
                }
            }
        });
    }

    listResources(): string[] {
        //console.log(this.resources);
        return Object.keys(this.resources);
    }

    get(name: string): any {
        return this.resources[name];
    }

    getLoad(name: string): any {
        return this.loads[name];
    }

    //creates an upside-down image
    flip(img: p5.Image): p5.Image {
        img.loadPixels();
        const img2 = createImage(img.width, img.height);
        img2.loadPixels();
        let newRow = img2.height - 1;
        for (let row = 0; row < img.height; row++) {
            for (let col = 0; col < img.width; col++) {
                const startIndex = (row * img.width + col) * 4;
                const newStartIndex = (newRow * img2.width + col) * 4;
                img2.pixels[newStartIndex] = img.pixels[startIndex];
                img2.pixels[newStartIndex + 1] = img.pixels[startIndex + 1];
                img2.pixels[newStartIndex + 2] = img.pixels[startIndex + 2];
                img2.pixels[newStartIndex + 3] = img.pixels[startIndex + 3];
            }
            newRow--;
        }
        img2.updatePixels();
        return img2;
    }

    //creates a reflected image from the original
    mirror(img: p5.Image): p5.Image {
        img.loadPixels();
        const img2 = createImage(img.width, img.height);
        img2.loadPixels();
        for (let row = 0; row < img.height; row++) {
            let newCol = img.width - 1;
            for (let col = 0; col < img.width; col++) {
                const startIndex = (row * img.width + col) * 4; //first index for pixel in row,col
                const endIndex = (row * img.width + newCol) * 4; //first index for pixel at end of row (counting backward)
                img2.pixels[endIndex] = img.pixels[startIndex];
                img2.pixels[endIndex + 1] = img.pixels[startIndex + 1];
                img2.pixels[endIndex + 2] = img.pixels[startIndex + 2];
                img2.pixels[endIndex + 3] = img.pixels[startIndex + 3];
                newCol--;
            }
        }
        img2.updatePixels();
        return img2;
    }
}
