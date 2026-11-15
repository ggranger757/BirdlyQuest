# BirdlyQuest

*Discover real birds with your camera.*

A mobile-only, offline-capable PWA collecting game. Go outside, photograph a **real** bird, and it is discovered: an encounter plays, your photo is turned on-device into a 32×32 pixel sprite, and the bird joins your BirdDex and Aviary as a pet that needs feeding.

- **Anywhere on Earth**: pick any country and state/province (or use your location). The local BirdDex comes live from iNaturalist research-grade records for that place; a curated list works offline.
- **Explore map**: real map with recent nearby bird sightings as pixel pins (sensitive species are never pinned).
- **Encounter & discovery**: wild-bird encounter, identify from a likely-species menu, record it with the Snap Lens, Discovered! Dex numbers, bird types, levels.
- **Pets & the feeder**: birds living in your Aviary (up to 12) slowly get hungry and fly to the bird feeder to eat. Buy food bags with Feathers (earned by discovering real birds, quests and badges) and pour them into the feeder; when it runs empty, birds go hungry. Extra birds rest in the Bird Box and don't need food. Birds never die; hungry birds are just weak.
- **Trainer**: partner bird, trainer card, 48 achievements in 7 categories (with a pop-up when earned), daily/weekly/seasonal quests, original chiptune music and SFX.

## Run it on GitHub Pages

1. Push this folder to a GitHub repository (default branch `main`).
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` runs tests, builds, and deploys via `.github/workflows/deploy.yml`.
4. Open `https://<you>.github.io/<repo>/` on your phone and use **Add to Home Screen**.

The build uses a relative base (`./`), so any repository name works. Camera access requires HTTPS, which GitHub Pages provides.

## Develop

```bash
npm install
npm run dev          # local dev server (phone on same Wi-Fi: use the printed network URL)
npm test             # core unit tests (XP, rarity, determinism, sprite gates, sun phases)
npm run build        # production build to dist/
npm run icons        # regenerate PWA icons from the sprite pipeline
```

A sprite lab (every species, every animation frame, silhouette test) lives at `#/lab` or Settings → Sprite lab. Five taps on the version line in Settings opens the debug panel (pipeline timings, storage, event log).

## Custom art & sound

- `public/sfx/`: owner-supplied sound clips: `buy.mp3` (purchases), `new-bird.mp3` (new BirdDex entry), `level-up.mp3` (trainer level-up and badges), `throw.mp3` (Snap Lens throw). Long jingles dip the background music while they play.

- `public/bg/`: layered parallax backgrounds (owner-supplied).
- `public/badges/`: 24 owner-supplied badge icons + capture effect, and 24 generated achievement badges (`b-*.png`). Regenerate or edit the generated ones with `python3 scripts/gen-badges.py` (frames per category, metals per tier, ASCII-art emblems).
- `public/fx/*.png`: Snap Lens effect sheets (ripple, bubble, ember, arcane, phantom).
- `public/chars/merlin.png`: Professor Merlin (48px cells; row 0 is the wing-flap hover).
- `public/music/main-theme.mp3`: the main theme (title, Explore, Trainer). Streamed, looped and cached on first play.

## Data, privacy and licensing

- No account, no server. Everything is stored in IndexedDB on the device; Settings offers backup/restore.
- Photos are re-encoded on capture, which strips EXIF/GPS. Only region codes are stored — never coordinates.
- Network calls (optional, cached for offline): **Open-Meteo** weather for the region centroid (free tier is non-commercial) and **iNaturalist** taxon photos (each photo is shown with its photographer and Creative Commons licence; only CC-licensed images are used). Call recordings link out to **Xeno-canto**.
- The species seed (`src/data/species.ts`) is hand-curated. Frequencies are coarse seed estimates for spawn weighting, not survey data. If you monetise, independently license your data and review the iNaturalist/Open-Meteo terms first. The eBird API is non-commercial only and is **not** used.
- Background art, badge icons and professor sprite were supplied by the project owner; confirm their licences before distributing.
- Country/state list: countries-states-cities-database (ODbL 1.0); attribution required, derived data stays under ODbL.
- Map tiles © OpenStreetMap contributors (ODbL; standard tile servers, no key). Reverse geocoding by BigDataCloud's free client API.
- Fonts: Silkscreen, Inter, Atkinson Hyperlegible (SIL OFL).
