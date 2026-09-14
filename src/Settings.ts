export class Settings {
    public playMusic: boolean;
    public playEvents: boolean;

    music: p5.SoundFile;

    menu: p5.Element;
    full: p5.Element;

    constructor() {
        this.playMusic = false;
        this.playEvents = true;
        this.menu = createDiv();
        this.menu.style("background-color", "rgba(0,0,0,0.75)");
        this.menu.position(30, 30);
        const instructions = createDiv(
            "Left/Right Arrows: Move<br>" +
                "Space: Jump<br>" +
                "F: Dash<br>" +
                "M: Open/Close this Menu<br>" +
                "Escape: Fullscreen"
        );
        instructions.style("color", "white");
        this.menu.child(instructions);
        const music = createCheckbox("Play Music", this.playMusic);
        music.changed(this.togglePlayMusic.bind(this));
        this.menu.child(music);
        const events = createCheckbox("Play Event Sounds", true);
        events.changed(this.toogleEventSounds.bind(this));
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

    togglePlayMusic() {
        this.playMusic = !this.playMusic;
        if (this.playMusic) {
            this.music.setLoop(true);
            this.music.playMode("restart");
            this.music.play();
        } else {
            this.music.stop();
        }
    }

    setMusic(m: p5.SoundFile) {
        this.music = m;
    }

    toogleEventSounds() {
        this.playEvents = !this.playEvents;
    }
}
