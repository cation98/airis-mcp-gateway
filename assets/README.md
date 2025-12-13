# GIF Recording Instructions

## Setup

1. Install Kap (free) or CleanShot X (paid, recommended)
   ```bash
   brew install --cask kap
   ```

2. Terminal settings for best GIF:
   - Black background
   - Green or white text
   - Font size: 14-16pt
   - Window size: ~1280x720

## Recording

1. Open terminal in project directory
2. Start Kap/CleanShot recording (select terminal window only)
3. Run the demo script:
   ```bash
   ./scripts/demo-for-gif.sh
   ```
4. Stop recording when "Done!" appears
5. Export as GIF (720px width, 15fps)

## Output

Save as `assets/demo.gif`

## Tips

- Keep terminal clean (no other tabs/windows visible)
- Hide menu bar if possible
- Target: 5-7 seconds, under 2MB
