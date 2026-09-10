import { Settings } from "./Settings.js";
import { GameAction } from "./GameAction.js";
import { GameMap } from "./GameMap.js";
import { InputManager } from "./InputManager.js";
import { ResourceManager } from "./ResourceManager.js";
import { SoundManager } from "./SoundManager.js";
import { CreatureState } from "./sprites/Creature.js";

export const GRAVITY: number = 0.002;

enum STATE {
    Loading,
    Menu,
    Running,
    Finished,
}

export class GameManager {
    resources: ResourceManager; //the resovoir of all loaded resources
    map: GameMap; //the current state of the game
    inputManager: InputManager; //mappings between user events (keyboard, mouse, etc.) and game actions (run-left, jump, etc.)
    settings: Settings;
    soundManager: SoundManager; //a player for background music and event sounds
    oldState: STATE;
    gameState: STATE; //the different possible states the game could be in (loading, menu, running, finished, etc.)
    level: number;
    moveRight: GameAction;
    moveLeft: GameAction;
    jump: GameAction;
    dash: GameAction;
    stop: GameAction;

    constructor() {
        this.level = 0;
        this.oldState = STATE.Loading;
        this.gameState = STATE.Loading;
        this.resources = new ResourceManager("assets/assets.json");
        this.inputManager = new InputManager();
        this.settings = new Settings();
        this.soundManager = new SoundManager();
        this.moveRight = new GameAction();
        this.moveLeft = new GameAction();
        this.jump = new GameAction();
        this.dash = new GameAction();
        this.stop = new GameAction();
    }

    draw() {
        switch (this.gameState) {
            case STATE.Running: {
                this.map.draw();
                break;
            }
            case STATE.Menu: {
                this.map.draw();
                //this.settings.draw();
                this.settings.showMenu();
                break;
            }
            case STATE.Loading: {
                break;
            }
            case STATE.Finished: {
                break;
            }
            default: {
                //should never happen
                console.error("IMPOSSIBLE STATE IN GAME");
                break;
            }
        }
    }

    update() {
        switch (this.gameState) {
            case STATE.Running: {
                this.map.update();
                this.inputManager.checkInput();
                this.processActions();
                break;
            }
            case STATE.Menu: {
                break;
            }
            case STATE.Loading: {
                if (this.resources.isLoaded()) {
                    //now setup the first map
                    this.map = new GameMap(this.level, this.resources, this.settings);
                    this.settings.setMusic(this.resources.getLoad("music"));
                    //this.map.player.setVelocity(1,1);
                    this.inputManager.setGameAction(this.moveRight, RIGHT_ARROW);
                    this.inputManager.setGameAction(this.moveLeft, LEFT_ARROW);
                    this.inputManager.setGameAction(this.jump, 32);
                    this.inputManager.setGameAction(this.dash, 70); // F
                    this.inputManager.setGameAction(this.stop, UP_ARROW);
                    this.oldState = STATE.Running;
                    this.gameState = STATE.Menu;
                }
                break;
            }
            case STATE.Finished: {
                break;
            }
            default: {
                //should never happen
                console.error("IMPOSSIBLE STATE IN GAME");
                break;
            }
        }
    }

    processActions() {
        const vel = this.map.player.getVelocity();
        vel.x = 0;
        if (this.moveRight.isPressed() && this.map.player.getState() == CreatureState.NORMAL) {
            vel.x = this.map.player.getMaxSpeed();
        }
        if (this.moveLeft.isPressed() && this.map.player.getState() == CreatureState.NORMAL) {
            vel.x = -this.map.player.getMaxSpeed();
        }
        if (this.map.player.isDashing()) {
            vel.x = this.map.player.getDashVelocityX();
        }
        this.map.player.setVelocity(vel.x, vel.y);
        if (this.jump.isPressed() && this.map.player.getState() == CreatureState.NORMAL) {
            this.map.player.jump(false);
        }
        if (this.dash.isBeginPress() && this.map.player.getState() == CreatureState.NORMAL) {
            this.map.player.dash();
        }
        if (this.stop.isBeginPress()) {
            throw new Error("STOP"); //for testing purposes only
        }
    }

    toggleFullScreen() {
        this.settings.toggleFullScreen();
    }

    toggleMenu() {
        if (this.gameState == STATE.Menu) {
            this.gameState = this.oldState;
            if (this.gameState != STATE.Menu) {
                this.settings.hideMenu();
            } else {
                this.settings.showMenu();
            }
        } else {
            this.oldState = this.gameState;
            this.gameState = STATE.Menu;
            this.settings.showMenu();
        }
    }
}
