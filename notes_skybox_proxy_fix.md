# CRITICAL: Skybox Proxy Blocks Staging URLs

The proxy only allows `blockadelabs.com` but the M4 skyboxes use `images-staging.blockadelabs.com`.
The proxy check is: `!url.includes("blockadelabs.com")` — this should work for staging too since it includes "blockadelabs.com".

Wait — it returned 403 Forbidden, not 400. Let me check if the staging server itself returns 403.

The M3 skyboxes (images.blockadelabs.com) work fine — 200 OK, 5MB image.
The M4 skyboxes (images-staging.blockadelabs.com) return 403.

This means the staging server requires authentication or the images have expired.

Options:
1. Use M3 skyboxes (they work)
2. Fix the proxy to handle staging auth
3. Download M4 skyboxes and host them on S3

For now, use M3 skyboxes which work perfectly. The getCached endpoint returns M3 skyboxes.
