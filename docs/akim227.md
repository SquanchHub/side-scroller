Repo organization: 
The repository is split into four main parts: src for the game code, assets for images, sounds, and maps, tests for testing game logic, and ai_log for saved AI session logs. Main.ts starts the game and passes control to GameManager. GameManager controls the overall game state, input, settings, resources, sound, and current level. ResourceManager loads the game’s files and turns them into usable sprites and animations. GameMap handles the level itself, including the player, enemies, projectiles, physics, collisions, and drawing.
The sprite system starts with a basic Sprite class, then adds more specific behavior for creatures, the player, enemies, projectiles, and effects. Each frame, the game reads input, updates the player’s actions, runs physics and collisions, updates animations, then draws everything to the screen.
AI tools used: I used the Claude Code extension in VS Code for the vast majority of the coding and debugging, and ChatGPT Images for the graphics assets.

For my ChatGPT conversation, I gave very specific descriptions of the assets I wanted, including the number of frames, specific poses, and even detailing and effects. The assets generated were effective because I already had a plan for exactly how I wanted to use them. There were also two ways to ask for sprites. I could get them separately, which saved the hassle of cropping and formatting the image, or I could have them included in one sheet, which made the assets more internally consistent. Because of this, I had it generate assets that naturally included variation (fireball, powerup, etc.) in separate images, and made spritesheets for the ones that needed to maintain a specific look (player, caveman, etc.). I noticed that the generator was remarkably consistent in the aesthetic it produced, which was usually good. But it also became a weakness when I wanted to iterate on designs and it would just give me something that looked near identical to previous outputs.

In Claude Code (session edfd4ef1): 
9/14, 10:48–11:55: I focused on playtesting fixes, mainly crashes, fullscreen/menu behavior, and cleaning up the git branches. 
9/14, 11:55–17:57: I started the T7 graphics rework, planned the asset pipeline, generated and processed the first batch of pixel-art assets, and added new player animations. 
9/14, 16:21–23:50: I iterated on the reskin, reverted the first pass when the visuals did not work well together, then restarted with better backgrounds and more careful sprite sizing and alignment. 
9/15, 00:25–03:29: I finished most of the main sprite processing, fixed several image-slicing, animation, collision, and grounding issues, and wired in the player’s jump and dash animations. 
9/15, 12:10–13:44: I added explosion and bug-juice death effects and fixed multiple enemy stomp/collision bugs. 
9/15, 14:13–15:55: I merged main into the graphics branch, resolved conflicts, fixed more collision edge cases, added fireball effects, powered player sprites, and a physics timestep fix. 
9/15, 20:43–21:32: I finished the fireball implementation, fixed a menu styling bug, tuned projectile behavior, and closed out the graphics branch. 
9/15, 21:38–23:26: I designed and implemented the stamina system, including the energy bar, bullets, double jump, shooting behavior, and stamina costs for abilities. 
Best practices learned: 

I definitely learned not to blindly trust AI output, especially when it comes to design work. I initially had Claude Code control the visual direction for each of the graphical elements, and after whipping that up quickly I found that the game was completely unplayable. It was nearly impossible to discern what was going on, because every element had the exact same color scheme and detailing. I think it’s important to keep in mind that these models can’t critically analyze their own outputs in the way that we humans can. They lack the sense for playability and user experience. 

On the other hand, when directed with specific descriptions of what I wanted it to produce, it was extremely accurate and effective. I think the key takeaway is that intentional AI use is far more powerful than simply letting it take the wheel and drive wherever it wants.

Other than that, I really felt the utility of having good version control, and being able to revert back to working versions if the AI messed up existing code.
