/**
 * This is a p5.js script (written in TypeScript).  You can read more about
 * p5.js at https://p5js.org.
 *
 * The global variables contain all the components/resources for a game.
 * These variables are initiailized in the preload() function.
 * the setup() function runs once and then the draw() function is called
 * multiple times per second while the game is running.
 *
 * All p5 "hooks" (functions which are called by p5) must be mapped onto
 * the global namespace.  See index.html to see how this is done.
 */

import { GameManager } from "./GameManager.js"; //handles loading of resources, keeping track and updating the state of everything in the game
import { Renderer } from "p5";

let game: GameManager;
let canvas: Renderer;

export function preload() {
    game = new GameManager(); //all resources are loaded via the constructor of the GameManager
}

export function setup() {
    frameRate(60);
    canvas = createCanvas(windowWidth, windowHeight);
    canvas.style("display", "block");
    canvas.style("padding", "0px");
    canvas.style("margin", "0px");
}
export function draw() {
    background(255); //just for testing purposes.  this probably can be removed when done.
    const scaleFactor = min(width / 800, height / 600);
    scale(scaleFactor, scaleFactor);
    if (focused) {
        game.update();
    }
    game.draw();
    fill(255);
    stroke(255);
    rect(800, 0, width * 10, height * 10); //a hack to make sure even with scaling only the correct portion of the game will be shown
}

export function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    //canvas.elt.width=800;
    //canvas.elt.height=600;
}

export function keyPressed() {
    if (key == "m") {
        game.toggleMenu();
    }
    if (keyCode == ENTER) {
        game.toggleFullScreen();
    }
}
