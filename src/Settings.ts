import { SoundManager } from "./SoundManager.js";

export class Settings {
    soundManager: SoundManager;

    menu: p5.Element;
    full: p5.Element;

    constructor(soundManager: SoundManager) {
        this.soundManager = soundManager;
        this.menu = createDiv();
        this.menu.style("background-color", "rgba(0,0,0,0.75)");
        this.menu.position(30, 30);
        const instructions = createDiv(
            "Left/Right Arrows: Move<br>" +
                "Space: Jump<br>" +
                "F: Dash<br>" +
                "G: Fire (after collecting a Fire Orb)<br>" +
                "M: Open/Close this Menu<br>" +
                "Enter: Toggle Fullscreen"
        );
        instructions.style("color", "white");
        this.menu.child(instructions);
        const music = createCheckbox("Play Music", this.soundManager.playMusic);
        music.changed(this.soundManager.toggleMusic.bind(this.soundManager));
        this.menu.child(music);
        const events = createCheckbox("Play Event Sounds", this.soundManager.playEvents);
        events.changed(this.soundManager.toggleEvents.bind(this.soundManager));
        this.menu.child(events);
        this.full = createCheckbox("Full Screen", false);
        this.full.changed(this.toggleFullScreen.bind(this));
        this.menu.child(this.full);
        this.menu.hide();
    }

    showMenu() {
        const scaleFactor = min(width / 800, height / 600);
        this.menu.size(800 * scaleFactor - 60, 600 * scaleFactor - 60);
        this.menu.show();
    }

    hideMenu() {
        this.menu.hide();
    }

    toggleFullScreen() {
        fullscreen(!fullscreen());
    }
}
