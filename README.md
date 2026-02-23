# Enhanced 3D Chemistry Lab – Acid-Base Titration Simulator

An interactive, browser-based acid-base titration simulator with a live 3D lab scene, real-time pH calculation, titration curve plotting, and 15 pH indicators.

## Features

- 7 titration types (strong/weak acid/base, diprotic, triprotic)
- 15 pH indicators with accurate color transitions
- Real-time pH, pOH, [H⁺], [OH⁻], Ka/Kb display
- Interactive titration curve with equivalence-point detection
- CSV data export
- 3D scene with Three.js (orbit controls, drop animation, liquid level)

## Project Structure

```
titration-lab/
├── index.html          # Main entry point
├── css/
│   └── style.css       # All styles
└── js/
    ├── indicators.js   # Indicator database + color interpolation
    ├── chemistry.js    # Pure pH calculation engine
    ├── scene3d.js      # Three.js scene, objects, animation helpers
    ├── curve.js        # 2D titration curve canvas rendering
    ├── ui.js           # DOM readout updates
    └── main.js         # App entry point, state, event wiring
```

## Usage

Open `index.html` in any modern browser — no build step required.  
All dependencies are loaded from CDN (`three@0.160.0`).

## Deployment

The project is a static site and can be deployed to GitHub Pages, Netlify, or any static host.

### GitHub Pages

1. Push to the `main` branch of your repository.
2. Go to **Settings → Pages** and set the source to the `main` branch, root folder.
3. Your simulator will be live at `https://<username>.github.io/<repo>/`.

## License

MIT
