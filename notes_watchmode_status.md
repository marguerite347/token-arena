# Watch Mode Status - Feb 21, 2026 5:14 AM

## What's visible:
- SPECTATOR MODE title with Eye icon
- ENTER THE ARENA button (gradient cyan-to-pink)
- SYSTEM LOG terminal window (top right) - shows skybox.loadTexture call
- ARENA CHAT window (top left) with input field
- STANDBY phase indicator (top left)
- TOKEN ARENA header (top center)
- The Three.js canvas IS rendering (element 2 is a canvas)
- Background is dark - the skybox texture IS loading (terminal shows the URL being loaded)

## Issues:
1. The skybox panorama is NOT visible yet - the idle overlay is blocking it with dark background
2. The idle overlay has `background: radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.9) 100%)` which is too opaque
3. Need to make the idle overlay more transparent so the 360° skybox shows through
4. The canvas element exists but the skybox sphere texture may not have loaded yet

## Terminal log shows:
- skybox.loadTexture("https://images.blockadelabs.com/images/imagine/M3_...") 
- This means the skybox IS being fetched but may be blocked by CORS or the proxy

## Next steps:
1. Make idle overlay semi-transparent so skybox shows through
2. Verify skybox texture actually loads (check proxy)
3. Add weapon particle effects
