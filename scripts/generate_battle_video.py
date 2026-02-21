#!/usr/bin/env python3
"""
Token Arena - Cinematic Battle Recap Video Generator
Generates MP4 videos from match replay data using Pillow + ffmpeg
with Blockade Labs Skybox Model 4 panoramic images as backgrounds.
"""

import json
import os
import sys
import math
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import numpy as np

# ─── Config ───────────────────────────────────────────────────────────────────
WIDTH, HEIGHT = 1280, 720
FPS = 30
ARENA_SIZE = 40  # game units
OUTPUT_DIR = Path("/home/ubuntu/token-arena/client/public/videos")
SKYBOX_DIR = Path("/home/ubuntu/token-arena/scripts/skybox_images")

# Skybox backgrounds for each video (Model 4 styles)
SKYBOX_BACKGROUNDS = [
    SKYBOX_DIR / "cyberpunk.jpg",    # M4 Cyberpunk (188) - Neon Brutalism
    SKYBOX_DIR / "ue_render.jpg",    # M4 UE Render (186) - Digital Void
    SKYBOX_DIR / "scifi_b.jpg",      # M4 SciFi B (178) - Crypto Wasteland
]

# Agent color palette
AGENT_COLORS = {
    "PHANTOM":  (255, 51, 102),    # hot pink / GPT-4o
    "NEXUS-7":  (0, 240, 255),     # cyan / Claude
    "TITAN":    (255, 165, 0),     # orange / Llama
    "CIPHER":   (180, 100, 255),   # purple / Mistral
    "WRAITH":   (100, 255, 100),   # green / DeepSeek
    "AURORA":   (255, 220, 50),    # gold / Gemini
}

MODEL_LABELS = {
    "gpt-4o":             "GPT-4o",
    "claude-3-5-sonnet":  "Claude 3.5",
    "llama-3.1-70b":      "Llama 3.1",
    "mistral-large":      "Mistral",
    "deepseek-v3":        "DeepSeek",
    "gemini-flash":       "Gemini 2.0",
}

WEAPON_COLORS = {
    "beam":     (0, 200, 255),
    "railgun":  (255, 50, 50),
    "scatter":  (255, 200, 0),
    "rocket":   (255, 100, 0),
    "plasma":   (200, 0, 255),
    "void":     (150, 0, 200),
}

# ─── Font loading ─────────────────────────────────────────────────────────────
def load_font(size=16, bold=False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()

FONT_SMALL  = load_font(14)
FONT_MED    = load_font(18)
FONT_LARGE  = load_font(24, bold=True)
FONT_XLARGE = load_font(36, bold=True)
FONT_HUGE   = load_font(56, bold=True)
FONT_TITLE  = load_font(64, bold=True)

# ─── Drawing helpers ──────────────────────────────────────────────────────────
def draw_text_shadow(draw, pos, text, font, fill, shadow=(0,0,0,200), offset=2):
    x, y = pos
    draw.text((x+offset, y+offset), text, font=font, fill=shadow)
    draw.text((x, y), text, font=font, fill=fill)

def draw_text_glow(draw, pos, text, font, fill, glow_color=None, glow_radius=3):
    """Draw text with a neon glow effect."""
    x, y = pos
    gc = glow_color or (fill[0]//2, fill[1]//2, fill[2]//2, 100)
    for dx in range(-glow_radius, glow_radius+1):
        for dy in range(-glow_radius, glow_radius+1):
            if dx*dx + dy*dy <= glow_radius*glow_radius:
                draw.text((x+dx, y+dy), text, font=font, fill=gc)
    draw.text((x, y), text, font=font, fill=fill)

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

# ─── Arena coordinate mapping ─────────────────────────────────────────────────
ARENA_MARGIN = 80
ARENA_X1 = ARENA_MARGIN
ARENA_Y1 = 80
ARENA_X2 = WIDTH - ARENA_MARGIN
ARENA_Y2 = HEIGHT - 160

def world_to_screen(x, z):
    half = ARENA_SIZE / 2
    sx = ARENA_X1 + (x + half) / ARENA_SIZE * (ARENA_X2 - ARENA_X1)
    sy = ARENA_Y1 + (z + half) / ARENA_SIZE * (ARENA_Y2 - ARENA_Y1)
    return int(sx), int(sy)

# ─── Skybox background processing ────────────────────────────────────────────
def prepare_skybox_background(skybox_path, darken=0.45):
    """
    Load a Blockade Labs equirectangular panorama and crop the center band
    to create a 16:9 background. Apply darkening for text readability.
    """
    print(f"  🌌 Loading skybox: {skybox_path.name}")
    img = Image.open(skybox_path).convert("RGBA")
    orig_w, orig_h = img.size
    
    # Equirectangular images are 2:1 ratio. Crop the center horizontal band
    # to get a 16:9 view (the "horizon" area which looks best)
    target_ratio = WIDTH / HEIGHT  # 16:9
    current_ratio = orig_w / orig_h  # 2:1
    
    if current_ratio > target_ratio:
        # Wider than needed — crop width to center
        new_w = int(orig_h * target_ratio)
        left = (orig_w - new_w) // 2
        img = img.crop((left, 0, left + new_w, orig_h))
    else:
        # Taller than needed — crop height to center
        new_h = int(orig_w / target_ratio)
        top = (orig_h - new_h) // 2
        img = img.crop((0, top, orig_w, top + new_h))
    
    # Resize to video dimensions
    img = img.resize((WIDTH, HEIGHT), Image.LANCZOS)
    
    # Apply darkening overlay for text contrast
    dark_overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, int(255 * darken)))
    img = Image.alpha_composite(img, dark_overlay)
    
    # Add subtle vignette effect
    vignette = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vignette)
    cx, cy = WIDTH // 2, HEIGHT // 2
    max_dist = math.sqrt(cx*cx + cy*cy)
    for ring in range(0, int(max_dist), 4):
        alpha = int(min(80, (ring / max_dist) ** 2 * 120))
        if alpha > 0:
            vdraw.ellipse([cx-ring, cy-ring, cx+ring, cy+ring], outline=(0, 0, 0, alpha), width=4)
    img = Image.alpha_composite(img, vignette)
    
    # Draw subtle grid overlay on the arena area
    grid_overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(grid_overlay)
    grid_color = (0, 200, 255, 25)
    grid_steps = 10
    for i in range(grid_steps + 1):
        t = i / grid_steps
        gx = int(ARENA_X1 + t * (ARENA_X2 - ARENA_X1))
        gy = int(ARENA_Y1 + t * (ARENA_Y2 - ARENA_Y1))
        gdraw.line([(gx, ARENA_Y1), (gx, ARENA_Y2)], fill=grid_color, width=1)
        gdraw.line([(ARENA_X1, gy), (ARENA_X2, gy)], fill=grid_color, width=1)
    img = Image.alpha_composite(img, grid_overlay)
    
    # Arena border glow
    border_overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(border_overlay)
    for w in range(5, 0, -1):
        alpha = 30 + w * 15
        bdraw.rectangle([ARENA_X1-w, ARENA_Y1-w, ARENA_X2+w, ARENA_Y2+w],
                        outline=(0, 200, 255, alpha), width=1)
    img = Image.alpha_composite(img, border_overlay)
    
    print(f"  ✅ Background ready: {WIDTH}x{HEIGHT}")
    return img


# ─── Frame rendering ──────────────────────────────────────────────────────────
def render_frame(bg, frame_data, replay, agents_meta, frame_idx, total_frames,
                 active_highlight=None, kill_flash=None, decisions=None):
    """Render a single video frame with skybox background."""
    img = bg.copy()
    draw = ImageDraw.Draw(img, "RGBA")

    agents_in_frame = frame_data.get("agents", [])
    projectiles = frame_data.get("projectiles", [])
    timestamp_ms = frame_data.get("timestamp", 0)

    # ── Header bar (semi-transparent over skybox) ─────────────────────────────
    header = Image.new("RGBA", (WIDTH, 65), (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(header)
    hdraw.rectangle([0, 0, WIDTH, 65], fill=(5, 5, 25, 180))
    img.paste(Image.alpha_composite(Image.new("RGBA", (WIDTH, 65), (0,0,0,0)), header), (0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    draw.line([(0, 65), (WIDTH, 65)], fill=(0, 200, 255, 80), width=1)

    # Title
    draw_text_shadow(draw, (20, 12), "TOKEN ARENA", FONT_LARGE, (0, 240, 255, 255))
    draw_text_shadow(draw, (20, 38), "AI AGENT BATTLE — BASE MAINNET", FONT_SMALL, (150, 200, 255, 200))

    # Skybox AI badge
    draw.rounded_rectangle([WIDTH - 200, 10, WIDTH - 20, 55], radius=8,
                            fill=(255, 100, 50, 40), outline=(255, 100, 50, 150), width=1)
    draw_text_shadow(draw, (WIDTH - 190, 15), "SKYBOX AI", FONT_MED, (255, 140, 80, 255))
    draw_text_shadow(draw, (WIDTH - 190, 35), "Model 4", FONT_SMALL, (255, 180, 120, 200))

    # Match time
    match_time = timestamp_ms / 1000
    time_str = f"{int(match_time // 60):02d}:{int(match_time % 60):02d}"
    draw_text_shadow(draw, (WIDTH//2 - 30, 18), time_str, FONT_XLARGE, (255, 255, 255, 255))

    # Progress bar
    progress = frame_idx / max(total_frames - 1, 1)
    bar_w = WIDTH - 40
    draw.rectangle([20, 61, 20 + bar_w, 65], fill=(20, 40, 60, 150))
    draw.rectangle([20, 61, 20 + int(bar_w * progress), 65], fill=(0, 200, 255, 200))

    # ── Kill flash overlay ─────────────────────────────────────────────────────
    if kill_flash and kill_flash["alpha"] > 0:
        flash_img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        flash_draw = ImageDraw.Draw(flash_img)
        kf = kill_flash
        alpha = int(kf["alpha"])
        flash_draw.rectangle([0, 0, WIDTH, HEIGHT], fill=(kf["r"], kf["g"], kf["b"], alpha))
        img = Image.alpha_composite(img, flash_img)
        draw = ImageDraw.Draw(img, "RGBA")

    # ── Projectiles ───────────────────────────────────────────────────────────
    for proj in projectiles:
        px, pz = proj.get("x", 0), proj.get("z", 0)
        sx, sy = world_to_screen(px, pz)
        weapon = proj.get("weapon", "beam")
        color = WEAPON_COLORS.get(weapon, (255, 255, 255))
        # Glow effect
        for r in range(8, 1, -1):
            alpha = 25 + (8 - r) * 15
            draw.ellipse([sx-r, sy-r, sx+r, sy+r], fill=(*color, alpha))
        draw.ellipse([sx-3, sy-3, sx+3, sy+3], fill=(*color, 255))

    # ── Agents ────────────────────────────────────────────────────────────────
    for agent in agents_in_frame:
        ax, az = agent.get("x", 0), agent.get("z", 0)
        sx, sy = world_to_screen(ax, az)
        name = agent.get("name", "?")
        is_alive = agent.get("isAlive", True)
        health = agent.get("health", 100)
        max_health = agent.get("maxHealth", 100)
        kills = agent.get("kills", 0)
        tokens = agent.get("tokens", 0)
        weapon = agent.get("weapon", "beam")
        rotation = agent.get("rotation", 0)

        color_hex = agent.get("color", "#ffffff")
        if color_hex.startswith("#"):
            color = hex_to_rgb(color_hex)
        else:
            color = AGENT_COLORS.get(name, (200, 200, 200))

        if not is_alive:
            draw.line([sx-12, sy-12, sx+12, sy+12], fill=(100, 100, 100, 180), width=3)
            draw.line([sx-12, sy+12, sx+12, sy-12], fill=(100, 100, 100, 180), width=3)
            draw_text_shadow(draw, (sx-20, sy+16), "ELIMINATED", FONT_SMALL, (150, 50, 50, 200))
            continue

        # Direction indicator
        dir_x = math.cos(rotation) * 22
        dir_z = math.sin(rotation) * 22
        ex, ey = int(sx + dir_x), int(sy + dir_z)
        draw.line([sx, sy, ex, ey], fill=(*color, 200), width=2)

        # Agent glow rings (bigger, more visible over skybox)
        for r in range(24, 8, -2):
            alpha = max(0, 100 - (r - 8) * 6)
            draw.ellipse([sx-r, sy-r, sx+r, sy+r], fill=(*color, alpha))

        # Agent body
        draw.ellipse([sx-12, sy-12, sx+12, sy+12], fill=(*color, 230), outline=(255, 255, 255, 220), width=2)

        # Weapon indicator dot
        weapon_color = WEAPON_COLORS.get(weapon, (200, 200, 200))
        draw.ellipse([sx-5, sy-5, sx+5, sy+5], fill=(*weapon_color, 255))

        # Health bar
        bar_x, bar_y = sx - 22, sy + 16
        bar_w = 44
        hp_ratio = health / max(max_health, 1)
        hp_color = (0, 255, 100) if hp_ratio > 0.5 else (255, 200, 0) if hp_ratio > 0.25 else (255, 50, 50)
        draw.rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + 5], fill=(20, 20, 20, 180))
        draw.rectangle([bar_x, bar_y, bar_x + int(bar_w * hp_ratio), bar_y + 5], fill=(*hp_color, 230))

        # Agent name label with background
        name_w = len(name) * 9
        draw.rounded_rectangle([sx - name_w//2 - 4, sy - 34, sx + name_w//2 + 4, sy - 18],
                                radius=4, fill=(0, 0, 0, 140))
        draw_text_shadow(draw, (sx - name_w//2, sy - 33), name, FONT_SMALL, (*color, 255))

        # Kills badge
        if kills > 0:
            badge_x = sx + 14
            badge_y = sy - 16
            draw.rounded_rectangle([badge_x, badge_y, badge_x + 22, badge_y + 16],
                                    radius=4, fill=(200, 0, 0, 200))
            draw.text((badge_x + 4, badge_y + 1), f"×{kills}", font=FONT_SMALL, fill=(255, 255, 255, 255))

        # Token count
        if tokens > 0:
            draw_text_shadow(draw, (sx - 20, sy + 24), f"◆{tokens}", FONT_SMALL, (255, 215, 0, 200))

    # ── Active highlight banner ───────────────────────────────────────────────
    if active_highlight:
        hl_title = active_highlight.get("title", "")
        hl_desc = active_highlight.get("description", "")
        if len(hl_desc) > 80:
            hl_desc = hl_desc[:80] + "..."
        # Banner background
        draw.rounded_rectangle([40, HEIGHT - 145, WIDTH - 40, HEIGHT - 85], radius=10,
                                fill=(10, 10, 40, 200), outline=(255, 215, 0, 180), width=2)
        draw_text_shadow(draw, (60, HEIGHT - 140), f"⚡ {hl_title}", FONT_MED, (255, 215, 0, 255))
        draw_text_shadow(draw, (60, HEIGHT - 115), hl_desc, FONT_SMALL, (200, 220, 255, 220))

    # ── Decision panel ────────────────────────────────────────────────────────
    if decisions:
        panel_y = ARENA_Y2 + 10
        for i, dec in enumerate(decisions[:2]):
            agent_name = dec.get("agent", "?")
            action = dec.get("action", "?")
            reasoning = dec.get("reasoning", "")
            if len(reasoning) > 50:
                reasoning = reasoning[:50] + "..."
            dx = 20 + i * (WIDTH // 2)
            draw.rounded_rectangle([dx, panel_y, dx + WIDTH//2 - 30, panel_y + 50],
                                    radius=6, fill=(10, 20, 50, 180), outline=(0, 200, 255, 80), width=1)
            agent_color = AGENT_COLORS.get(agent_name, (200, 200, 200))
            draw_text_shadow(draw, (dx + 10, panel_y + 4), f"{agent_name}: {action}", FONT_SMALL, (*agent_color, 255))
            draw_text_shadow(draw, (dx + 10, panel_y + 24), reasoning, FONT_SMALL, (180, 200, 220, 180))

    # ── Bottom info bar ───────────────────────────────────────────────────────
    draw.rectangle([0, HEIGHT - 50, WIDTH, HEIGHT], fill=(5, 5, 25, 200))
    draw.line([(0, HEIGHT - 50), (WIDTH, HEIGHT - 50)], fill=(0, 200, 255, 60), width=1)

    # Agent scoreboard
    alive_agents = [a for a in agents_in_frame if a.get("isAlive", True)]
    dead_agents = [a for a in agents_in_frame if not a.get("isAlive", True)]
    draw_text_shadow(draw, (20, HEIGHT - 42), f"ALIVE: {len(alive_agents)}", FONT_MED, (0, 255, 100, 255))
    draw_text_shadow(draw, (160, HEIGHT - 42), f"ELIMINATED: {len(dead_agents)}", FONT_MED, (255, 80, 80, 255))

    # Bounty badges
    badges = [
        ("Base L2", (50, 150, 255)),
        ("Skybox AI M4", (255, 100, 50)),
        ("ERC-8021", (100, 255, 150)),
    ]
    for i, (label, bcolor) in enumerate(badges):
        bx = WIDTH - 380 + i * 130
        by = HEIGHT - 45
        draw.rounded_rectangle([bx, by, bx + 120, by + 30], radius=6,
                                fill=(*bcolor, 40), outline=(*bcolor, 150), width=1)
        draw_text_shadow(draw, (bx + 8, by + 7), label, FONT_SMALL, (*bcolor, 255))

    return img.convert("RGB")


# ─── Intro frame rendering ───────────────────────────────────────────────────
def render_intro_frame(bg, replay, agents_meta, frame_idx, total_intro):
    """Render an intro frame with skybox background and match info."""
    img = bg.copy()
    draw = ImageDraw.Draw(img, "RGBA")

    fade_t = min(1.0, frame_idx / (total_intro * 0.3))
    alpha = int(255 * fade_t)

    # Dark overlay for text readability during intro
    intro_overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 10, int(100 * (1 - fade_t * 0.5))))
    img = Image.alpha_composite(img, intro_overlay)
    draw = ImageDraw.Draw(img, "RGBA")

    # "SKYBOX AI" watermark in corner
    draw.rounded_rectangle([WIDTH - 220, 15, WIDTH - 15, 60], radius=8,
                            fill=(255, 100, 50, int(60 * fade_t)),
                            outline=(255, 100, 50, int(180 * fade_t)), width=2)
    draw_text_shadow(draw, (WIDTH - 210, 20), "SKYBOX AI", FONT_MED, (255, 140, 80, alpha))
    draw_text_shadow(draw, (WIDTH - 210, 40), "Model 4 Arena", FONT_SMALL, (255, 180, 120, int(200 * fade_t)))

    # Title
    draw_text_glow(draw, (WIDTH//2 - 280, 100), "TOKEN ARENA", FONT_TITLE,
                   (0, 240, 255, alpha), glow_color=(0, 100, 200, int(60 * fade_t)))

    # Subtitle
    draw_text_shadow(draw, (WIDTH//2 - 200, 180), "AI AGENT BATTLE RECAP", FONT_LARGE,
                     (255, 255, 255, alpha))

    # Match info
    agents = replay.get("agents", [])
    if len(agents) >= 2:
        a1 = agents[0]
        a2 = agents[1]
        a1_name = a1.get("name", "Agent 1")
        a2_name = a2.get("name", "Agent 2")
        a1_color = hex_to_rgb(a1.get("color", "#ff3366")) if a1.get("color", "").startswith("#") else AGENT_COLORS.get(a1_name, (255, 100, 100))
        a2_color = hex_to_rgb(a2.get("color", "#00f0ff")) if a2.get("color", "").startswith("#") else AGENT_COLORS.get(a2_name, (0, 200, 255))

        # VS display
        vs_y = 260
        draw_text_glow(draw, (WIDTH//4 - 60, vs_y), a1_name, FONT_XLARGE,
                       (*a1_color, alpha), glow_color=(*[c//3 for c in a1_color], int(80 * fade_t)))
        draw_text_shadow(draw, (WIDTH//2 - 20, vs_y + 5), "VS", FONT_LARGE, (255, 215, 0, alpha))
        draw_text_glow(draw, (WIDTH*3//4 - 60, vs_y), a2_name, FONT_XLARGE,
                       (*a2_color, alpha), glow_color=(*[c//3 for c in a2_color], int(80 * fade_t)))

        # Model labels
        a1_model = ""
        a2_model = ""
        for am in agents_meta:
            if am.get("name") == a1_name:
                a1_model = MODEL_LABELS.get(am.get("llmModel", ""), am.get("llmModel", ""))
            if am.get("name") == a2_name:
                a2_model = MODEL_LABELS.get(am.get("llmModel", ""), am.get("llmModel", ""))
        if a1_model:
            draw_text_shadow(draw, (WIDTH//4 - 40, vs_y + 50), a1_model, FONT_MED, (180, 200, 255, alpha))
        if a2_model:
            draw_text_shadow(draw, (WIDTH*3//4 - 40, vs_y + 50), a2_model, FONT_MED, (180, 200, 255, alpha))

    # Weapon loadouts
    if len(agents) >= 2 and fade_t > 0.4:
        wep_fade = min(1.0, (fade_t - 0.4) * 2)
        wep_alpha = int(220 * wep_fade)
        a1_wep = agents[0].get("primaryWeapon", "plasma")
        a2_wep = agents[1].get("primaryWeapon", "plasma")
        draw_text_shadow(draw, (WIDTH//4 - 40, 370), f"⚔ {a1_wep.upper()}", FONT_MED, (255, 200, 100, wep_alpha))
        draw_text_shadow(draw, (WIDTH*3//4 - 40, 370), f"⚔ {a2_wep.upper()}", FONT_MED, (255, 200, 100, wep_alpha))

    # Arena name
    arena_name = replay.get("arenaName", "Neon Brutalism Arena")
    if fade_t > 0.5:
        arena_fade = min(1.0, (fade_t - 0.5) * 2)
        draw.rounded_rectangle([WIDTH//2 - 200, 440, WIDTH//2 + 200, 480], radius=10,
                                fill=(10, 20, 50, int(180 * arena_fade)),
                                outline=(0, 200, 255, int(150 * arena_fade)), width=2)
        draw_text_shadow(draw, (WIDTH//2 - 120, 450), f"🌌 {arena_name}", FONT_MED,
                         (0, 240, 255, int(255 * arena_fade)))

    # Footer
    if fade_t > 0.6:
        ft_fade = min(1.0, (fade_t - 0.6) * 2.5)
        ft_alpha = int(255 * ft_fade)
        draw_text_shadow(draw, (20, HEIGHT - 60), "Powered by Blockade Labs Skybox AI • Base L2 • OpenRouter",
                         FONT_SMALL, (150, 180, 220, ft_alpha))
        draw_text_shadow(draw, (20, HEIGHT - 35), "ETHDenver 2026 Hackathon — Token Arena",
                         FONT_SMALL, (100, 150, 200, ft_alpha))

    return img.convert("RGB")


# ─── Outro frame rendering ───────────────────────────────────────────────────
def render_outro_frame(bg, replay, agents_meta, frame_idx, total_outro):
    """Render an outro/victory frame with skybox background."""
    img = bg.copy()
    draw = ImageDraw.Draw(img, "RGBA")

    fade_t = min(1.0, frame_idx / (total_outro * 0.4))
    alpha = int(255 * fade_t)

    # Darken for readability
    dark = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 10, int(120 * fade_t)))
    img = Image.alpha_composite(img, dark)
    draw = ImageDraw.Draw(img, "RGBA")

    mvp = replay.get("mvpName", "UNKNOWN")
    mvp_kills = replay.get("mvpKills", 0)
    mvp_tokens = replay.get("mvpTokens", 0)
    total_kills = replay.get("totalKills", 0)

    mvp_color = AGENT_COLORS.get(mvp, (255, 215, 0))
    for am in agents_meta:
        if am.get("name") == mvp:
            break

    # Victory title
    draw_text_glow(draw, (WIDTH//2 - 200, 60), "MATCH COMPLETE", FONT_XLARGE,
                   (255, 215, 0, alpha), glow_color=(150, 120, 0, int(60 * fade_t)))

    # MVP section
    draw.rounded_rectangle([WIDTH//2 - 320, 140, WIDTH//2 + 320, 380], radius=15,
                            fill=(10, 20, 50, int(200 * fade_t)),
                            outline=(*mvp_color, int(200 * fade_t)), width=3)

    draw_text_shadow(draw, (WIDTH//2 - 30, 155), "MVP", FONT_LARGE, (200, 200, 200, alpha))

    # MVP name with glow
    mvp_x = WIDTH//2 - len(mvp) * 22
    draw_text_glow(draw, (mvp_x, 195), mvp, FONT_HUGE, (*mvp_color, alpha),
                   glow_color=(mvp_color[0]//3, mvp_color[1]//3, mvp_color[2]//3, int(80 * fade_t)))

    # MVP model
    model_label = ""
    for am in agents_meta:
        if am.get("name") == mvp:
            model_label = MODEL_LABELS.get(am.get("llmModel", ""), am.get("llmModel", ""))
            break
    if model_label:
        draw_text_shadow(draw, (WIDTH//2 - len(model_label)*7, 275), f"Powered by {model_label}", FONT_MED,
                         (180, 200, 255, alpha))

    # Stats
    stats = [
        (f"{mvp_kills}", "KILLS"),
        (f"{mvp_tokens:,}", "ARENA TOKENS"),
        (f"{total_kills}", "TOTAL KILLS"),
    ]
    for i, (val, label) in enumerate(stats):
        sx = WIDTH//2 - 220 + i * 220
        draw_text_shadow(draw, (sx, 310), val, FONT_XLARGE, (255, 255, 255, alpha))
        draw_text_shadow(draw, (sx, 350), label, FONT_SMALL, (150, 180, 220, alpha))

    # Highlights
    highlights = replay.get("highlights", [])
    if highlights and fade_t > 0.5:
        hl_fade = min(1.0, (fade_t - 0.5) * 2)
        draw_text_shadow(draw, (WIDTH//2 - 80, 410), "HIGHLIGHTS", FONT_MED,
                         (0, 200, 255, int(255 * hl_fade)))
        for i, hl in enumerate(highlights[:3]):
            hl_y = 440 + i * 30
            title = hl.get("title", "")
            desc = hl.get("description", "")
            if len(desc) > 70:
                desc = desc[:70] + "..."
            draw_text_shadow(draw, (WIDTH//2 - 300, hl_y), f"• {title}: {desc}", FONT_SMALL,
                             (200, 220, 255, int(220 * hl_fade)))

    # Footer badges — showcase bounty integrations
    if fade_t > 0.6:
        badge_fade = min(1.0, (fade_t - 0.6) * 2.5)
        badges = [
            ("Base Mainnet", (50, 150, 255)),
            ("Skybox AI M4", (255, 100, 50)),
            ("ERC-8021", (100, 255, 150)),
            ("Uniswap", (255, 0, 122)),
        ]
        for i, (label, color) in enumerate(badges):
            bx = 50 + i * 200
            by = HEIGHT - 70
            draw.rounded_rectangle([bx, by, bx + 170, by + 40], radius=8,
                                    fill=(*color, int(50 * badge_fade)),
                                    outline=(*color, int(180 * badge_fade)), width=2)
            draw_text_shadow(draw, (bx + 15, by + 12), label, FONT_MED, (*color, int(255 * badge_fade)))

    return img.convert("RGB")


# ─── Main video generation ────────────────────────────────────────────────────
def generate_video(replay, agents_meta, output_path, skybox_bg):
    """Generate a full battle recap video for one replay with skybox background."""
    print(f"\n🎬 Generating video for Match {replay['matchId']} — {replay['mvpName']} wins")

    frames_data = replay.get("frames", [])
    highlights = replay.get("highlights", [])
    events = replay.get("events", [])
    combat_log = replay.get("combatLog", [])

    if not frames_data:
        print("  ⚠️  No frame data, skipping")
        return False

    # Build highlight timeline
    hl_timeline = {}
    for hl in highlights:
        ts = hl.get("timestamp", 0)
        dur = hl.get("duration", 3000)
        hl_timeline[ts] = (hl, dur)

    # Build decision timeline
    decisions_by_tick = {}
    for entry in combat_log:
        if entry.get("type") == "decision":
            tick = entry.get("tick", 0)
            if tick not in decisions_by_tick:
                decisions_by_tick[tick] = []
            decisions_by_tick[tick].append(entry)

    # Build kill event timeline
    kill_events = [(e.get("timestamp", 0), e) for e in events if e.get("type") == "kill"]

    HOLD_FRAMES_PER_GAME_FRAME = 45  # 1.5s at 30fps
    INTRO_FRAMES = FPS * 3   # 3 second intro
    OUTRO_FRAMES = FPS * 4   # 4 second outro

    total_battle_frames = len(frames_data) * HOLD_FRAMES_PER_GAME_FRAME
    total_video_frames = INTRO_FRAMES + total_battle_frames + OUTRO_FRAMES

    print(f"  📊 {len(frames_data)} game frames → {total_video_frames} total frames")

    with tempfile.TemporaryDirectory() as tmpdir:
        frame_count = 0

        # ── Intro frames ──────────────────────────────────────────────────────
        print("  🎬 Rendering intro...")
        for i in range(INTRO_FRAMES):
            frame_img = render_intro_frame(skybox_bg, replay, agents_meta, i, INTRO_FRAMES)
            frame_img.save(f"{tmpdir}/frame_{frame_count:06d}.jpg", quality=85)
            frame_count += 1

        # ── Battle frames ─────────────────────────────────────────────────────
        print("  ⚔️  Rendering battle frames...")
        active_highlight = None
        active_highlight_end = 0
        kill_flash = {"alpha": 0, "r": 255, "g": 50, "b": 50}
        current_decisions = []

        for gi, game_frame in enumerate(frames_data):
            ts = game_frame.get("timestamp", 0)

            for hl_ts, (hl, hl_dur) in hl_timeline.items():
                if abs(ts - hl_ts) < 5000:
                    active_highlight = hl
                    active_highlight_end = ts + hl_dur
                    break

            if active_highlight and ts > active_highlight_end:
                active_highlight = None

            for kill_ts, kill_evt in kill_events:
                if abs(ts - kill_ts) < 3000:
                    kill_flash = {"alpha": 80, "r": 255, "g": 50, "b": 50}
                    break

            tick = gi
            if tick in decisions_by_tick:
                current_decisions = decisions_by_tick[tick]

            for hi in range(HOLD_FRAMES_PER_GAME_FRAME):
                if kill_flash["alpha"] > 0:
                    kill_flash["alpha"] = max(0, kill_flash["alpha"] - 4)

                frame_img = render_frame(
                    skybox_bg, game_frame, replay, agents_meta,
                    gi, len(frames_data),
                    active_highlight=active_highlight if hi < HOLD_FRAMES_PER_GAME_FRAME * 0.7 else None,
                    kill_flash=kill_flash,
                    decisions=current_decisions if hi < HOLD_FRAMES_PER_GAME_FRAME * 0.8 else None
                )
                frame_img.save(f"{tmpdir}/frame_{frame_count:06d}.jpg", quality=85)
                frame_count += 1

        # ── Outro frames ──────────────────────────────────────────────────────
        print("  🏆 Rendering outro...")
        for i in range(OUTRO_FRAMES):
            frame_img = render_outro_frame(skybox_bg, replay, agents_meta, i, OUTRO_FRAMES)
            frame_img.save(f"{tmpdir}/frame_{frame_count:06d}.jpg", quality=85)
            frame_count += 1

        # ── Encode with ffmpeg ─────────────────────────────────────────────────
        print(f"  🎞️  Encoding {frame_count} frames to MP4...")
        cmd = [
            "ffmpeg", "-y",
            "-framerate", str(FPS),
            "-i", f"{tmpdir}/frame_%06d.jpg",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            str(output_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"  ❌ ffmpeg error: {result.stderr[-500:]}")
            return False

        size_mb = os.path.getsize(output_path) / 1024 / 1024
        print(f"  ✅ Video saved: {output_path} ({size_mb:.1f} MB)")
        return True


# ─── Entry point ──────────────────────────────────────────────────────────────
def main():
    print("🎮 Token Arena — Battle Recap Video Generator (Skybox Edition)")
    print("=" * 60)

    # Load replay data
    replay_file = Path("/tmp/replays.json")
    if not replay_file.exists():
        print("❌ No replay data found at /tmp/replays.json")
        sys.exit(1)

    with open(replay_file) as f:
        replays = json.load(f)

    agents_meta = [
        {"name": "PHANTOM",  "llmModel": "gpt-4o"},
        {"name": "NEXUS-7",  "llmModel": "claude-3-5-sonnet"},
        {"name": "TITAN",    "llmModel": "llama-3.1-70b"},
        {"name": "CIPHER",   "llmModel": "mistral-large"},
        {"name": "WRAITH",   "llmModel": "deepseek-v3"},
        {"name": "AURORA",   "llmModel": "gemini-flash"},
    ]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Prepare skybox backgrounds
    print("\n🌌 Preparing Skybox Model 4 backgrounds...")
    skybox_bgs = []
    for i, skybox_path in enumerate(SKYBOX_BACKGROUNDS):
        if skybox_path.exists():
            bg = prepare_skybox_background(skybox_path, darken=0.40)
            skybox_bgs.append(bg)
        else:
            print(f"  ⚠️  Missing skybox: {skybox_path}, using fallback")
            # Fallback: dark gradient
            bg = Image.new("RGBA", (WIDTH, HEIGHT), (5, 0, 20, 255))
            skybox_bgs.append(bg)

    generated = []
    for i, replay in enumerate(replays):
        bg = skybox_bgs[i % len(skybox_bgs)]
        output_path = OUTPUT_DIR / f"battle_recap_{i+1}_{replay['mvpName'].lower()}.mp4"
        success = generate_video(replay, agents_meta, output_path, bg)
        if success:
            generated.append({
                "file": output_path.name,
                "matchId": replay["matchId"],
                "mvpName": replay["mvpName"],
                "totalKills": replay["totalKills"],
            })

    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(generated, f, indent=2)

    print(f"\n✅ Generated {len(generated)} videos with Skybox M4 backgrounds")
    for v in generated:
        print(f"  • {v['file']} — {v['mvpName']} wins, {v['totalKills']} kills")
    print(f"\n📁 Output: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
