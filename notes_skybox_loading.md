# Skybox Loading Analysis

## The API is returning skybox data correctly:
- fileUrl: https://images.blockadelabs.com/images/imagine/M3_Dystopian_Render_equirectangular-jpg_In_a_post-apocalyptic_desert_9623416410_14997659.jpg?ver=1
- fileUrl: https://images.blockadelabs.com/images/imagine/M3_Open_World_equirectangular-jpg_A_colossal_cyberpunk_arena_8223941509_14997657.jpg?ver=1

## Problem:
The loadSkybox function uses the skybox proxy at /api/skybox-proxy?url=... to avoid CORS.
But the idle overlay is too opaque (rgba(0,0,0,0.7) to rgba(0,0,0,0.9)) so even if the skybox loads, you can't see it.

## Fix needed:
1. Make the idle overlay much more transparent so the 360° skybox shows through
2. Verify the skybox proxy is working correctly for these URLs
3. The Three.js TextureLoader needs the proxied URL, not the raw blockadelabs URL
