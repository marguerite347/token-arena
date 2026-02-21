#!/usr/bin/env python3
"""
Token Arena - Cinematic Battle Recap Video Generator
Generates MP4 videos from match replay data using Pillow + ffmpeg
"""

import json
import os
import sys
import math
import subprocess
import shutil
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np

# ─── Config ───────────────────────────────────────────────────────────────────
WIDTH, HEIGHT = 1280, 720
FPS = 30
ARENA_SIZE = 40  # game units
OUTPUT_DIR = Path("/home/ubuntu/token-arena/client/public/videos")
FONT_DIR = Path("/usr/share/fonts")

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
    """Load a font, falling back to default if not found."""
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-Bold.ttf" if bold else "/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf",
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

# ─── Drawing helpers ──────────────────────────────────────────────────────────
def draw_text_shadow(draw, pos, text, font, fill, shadow=(0,0,0,180), offset=2):
    x, y = pos
    draw.text((x+offset, y+offset), text, font=font, fill=shadow)
    draw.text((x, y), text, font=font, fill=fill)

def draw_rounded_rect(draw, bbox, radius, fill, outline=None, outline_width=2):
    x1, y1, x2, y2 = bbox
    draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=fill, outline=outline, width=outline_width)

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
    """Convert game world coords to screen pixels."""
    half = ARENA_SIZE / 2
    sx = ARENA_X1 + (x + half) / ARENA_SIZE * (ARENA_X2 - ARENA_X1)
    sy = ARENA_Y1 + (z + half) / ARENA_SIZE * (ARENA_Y2 - ARENA_Y1)
    return int(sx), int(sy)

# ─── Background generation ────────────────────────────────────────────────────
def create_arena_background():
    """Create a dark sci-fi arena background."""
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    # Deep space gradient background
    for y in range(HEIGHT):
        t = y / HEIGHT
        r = int(lerp_color((5, 0, 20), (15, 5, 40), t)[0])
        g = int(lerp_color((5, 0, 20), (15, 5, 40), t)[1])
        b = int(lerp_color((5, 0, 20), (15, 5, 40), t)[2])
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b, 255))

    # Grid lines (arena floor)
    grid_color = (30, 60, 80, 120)
    grid_steps = 8
    for i in range(grid_steps + 1):
        t = i / grid_steps
        gx = int(ARENA_X1 + t * (ARENA_X2 - ARENA_X1))
        gy = int(ARENA_Y1 + t * (ARENA_Y2 - ARENA_Y1))
        draw.line([(gx, ARENA_Y1), (gx, ARENA_Y2)], fill=grid_color, width=1)
        draw.line([(ARENA_X1, gy), (ARENA_X2, gy)], fill=grid_color, width=1)

    # Arena border glow
    for w in range(4, 0, -1):
        alpha = 60 + w * 20
        draw.rectangle([ARENA_X1-w, ARENA_Y1-w, ARENA_X2+w, ARENA_Y2+w],
                        outline=(0, 200, 255, alpha), width=1)

    # Corner markers
    corner_size = 12
    corner_color = (0, 240, 255, 200)
    corners = [(ARENA_X1, ARENA_Y1), (ARENA_X2, ARENA_Y1),
               (ARENA_X1, ARENA_Y2), (ARENA_X2, ARENA_Y2)]
    for cx, cy in corners:
        draw.line([(cx, cy), (cx + corner_size, cy)], fill=corner_color, width=2)
        draw.line([(cx, cy), (cx, cy + corner_size)], fill=corner_color, width=2)

    # Stars in background
    rng = np.random.default_rng(42)
    for _ in range(80):
        sx = int(rng.integers(0, WIDTH))
        sy = int(rng.integers(0, HEIGHT // 2))
        brightness = int(rng.integers(100, 200))
        draw.ellipse([sx-1, sy-1, sx+1, sy+1], fill=(brightness, brightness, brightness, 150))

    return img

BG = create_arena_background()

# ─── Frame rendering ──────────────────────────────────────────────────────────
def render_frame(frame_data, replay, agents_meta, frame_idx, total_frames,
                 active_highlight=None, kill_flash=None, decisions=None):
    """Render a single video frame."""
    img = BG.copy()
    draw = ImageDraw.Draw(img, "RGBA")

    agents_in_frame = frame_data.get("agents", [])
    projectiles = frame_data.get("projectiles", [])
    timestamp_ms = frame_data.get("timestamp", 0)

    # ── Header bar ────────────────────────────────────────────────────────────
    draw.rectangle([0, 0, WIDTH, 60], fill=(5, 5, 25, 220))
    draw.line([(0, 60), (WIDTH, 60)], fill=(0, 200, 255, 100), width=1)

    # Title
    draw_text_shadow(draw, (20, 12), "TOKEN ARENA", FONT_LARGE, (0, 240, 255, 255))
    draw_text_shadow(draw, (20, 36), "AI AGENT BATTLE — BASE SEPOLIA", FONT_SMALL, (150, 200, 255, 200))

    # Match info
    match_time = timestamp_ms / 1000
    time_str = f"{int(match_time // 60):02d}:{int(match_time % 60):02d}"
    draw_text_shadow(draw, (WIDTH//2 - 30, 18), time_str, FONT_XLARGE, (255, 255, 255, 255))

    # Progress bar
    progress = frame_idx / max(total_frames - 1, 1)
    bar_w = WIDTH - 40
    draw.rectangle([20, 56, 20 + bar_w, 60], fill=(20, 40, 60, 200))
    draw.rectangle([20, 56, 20 + int(bar_w * progress), 60], fill=(0, 200, 255, 200))

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
        for r in range(6, 1, -1):
            alpha = 30 + (6 - r) * 20
            draw.ellipse([sx-r, sy-r, sx+r, sy+r], fill=(*color, alpha))
        draw.ellipse([sx-2, sy-2, sx+2, sy+2], fill=(*color, 255))

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

        # Agent color
        color_hex = agent.get("color", "#ffffff")
        if color_hex.startswith("#"):
            color = hex_to_rgb(color_hex)
        else:
            color = AGENT_COLORS.get(name, (200, 200, 200))

        if not is_alive:
            # Dead agent — grey X
            draw.line([sx-10, sy-10, sx+10, sy+10], fill=(100, 100, 100, 180), width=2)
            draw.line([sx-10, sy+10, sx+10, sy-10], fill=(100, 100, 100, 180), width=2)
            continue

        # Direction indicator
        dir_x = math.cos(rotation) * 18
        dir_z = math.sin(rotation) * 18
        ex, ey = int(sx + dir_x), int(sy + dir_z)
        draw.line([sx, sy, ex, ey], fill=(*color, 180), width=2)

        # Agent glow rings
        for r in range(20, 8, -3):
            alpha = max(0, 80 - (r - 8) * 8)
            draw.ellipse([sx-r, sy-r, sx+r, sy+r], fill=(*color, alpha))

        # Agent body
        draw.ellipse([sx-10, sy-10, sx+10, sy+10], fill=(*color, 220), outline=(255, 255, 255, 200), width=2)

        # Weapon indicator dot
        weapon_color = WEAPON_COLORS.get(weapon, (200, 200, 200))
        draw.ellipse([sx-4, sy-4, sx+4, sy+4], fill=(*weapon_color, 255))

        # Health bar
        bar_x, bar_y = sx - 20, sy + 14
        bar_w = 40
        hp_ratio = health / max(max_health, 1)
        hp_color = (0, 255, 100) if hp_ratio > 0.5 else (255, 200, 0) if hp_ratio > 0.25 else (255, 50, 50)
        draw.rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + 4], fill=(40, 40, 40, 180))
        draw.rectangle([bar_x, bar_y, bar_x + int(bar_w * hp_ratio), bar_y + 4], fill=(*hp_color, 220))

        # Agent name label
        name_x = sx - 20
        name_y = sy - 30
        draw_text_shadow(draw, (name_x, name_y), name, FONT_SMALL, (*color, 255))

        # Kills badge
        if kills > 0:
            badge_x = sx + 12
            badge_y = sy - 14
            draw.ellipse([badge_x, badge_y, badge_x+16, badge_y+16], fill=(255, 50, 50, 220))
            draw_text_shadow(draw, (badge_x+4, badge_y+2), str(kills), FONT_SMALL, (255, 255, 255, 255), shadow=(0,0,0,200), offset=1)

    # ── Agent scorecards (sidebar) ─────────────────────────────────────────────
    card_x = WIDTH - 220
    card_y = 70
    draw.rectangle([card_x - 10, card_y - 5, WIDTH - 5, HEIGHT - 10], fill=(5, 10, 30, 180))
    draw_text_shadow(draw, (card_x, card_y), "AGENTS", FONT_MED, (0, 200, 255, 255))
    card_y += 28

    for agent in agents_in_frame:
        name = agent.get("name", "?")
        is_alive = agent.get("isAlive", True)
        health = agent.get("health", 100)
        max_health = agent.get("maxHealth", 100)
        kills = agent.get("kills", 0)
        tokens = agent.get("tokens", 0)
        weapon = agent.get("weapon", "beam")

        color_hex = agent.get("color", "#ffffff")
        color = hex_to_rgb(color_hex) if color_hex.startswith("#") else AGENT_COLORS.get(name, (200, 200, 200))

        # Find LLM model
        model_label = ""
        for am in agents_meta:
            if am.get("name") == name:
                model_label = MODEL_LABELS.get(am.get("llmModel", ""), am.get("llmModel", ""))
                break

        # Card background
        card_bg = (10, 30, 50, 180) if is_alive else (30, 10, 10, 150)
        draw.rounded_rectangle([card_x - 5, card_y - 3, WIDTH - 8, card_y + 72], radius=6, fill=card_bg)
        draw.line([(card_x - 5, card_y - 3), (card_x - 5, card_y + 72)], fill=(*color, 200), width=3)

        # Name + model
        name_color = color if is_alive else (100, 100, 100)
        draw_text_shadow(draw, (card_x + 2, card_y), name, FONT_MED, (*name_color, 255))
        if model_label:
            draw_text_shadow(draw, (card_x + 2, card_y + 18), model_label, FONT_SMALL, (150, 180, 220, 200))

        # Stats
        hp_ratio = health / max(max_health, 1)
        hp_color = (0, 255, 100) if hp_ratio > 0.5 else (255, 200, 0) if hp_ratio > 0.25 else (255, 50, 50)
        hp_str = f"HP: {health}/{max_health}" if is_alive else "ELIMINATED"
        hp_text_color = hp_color if is_alive else (200, 50, 50)
        draw_text_shadow(draw, (card_x + 2, card_y + 34), hp_str, FONT_SMALL, (*hp_text_color, 220))

        # HP bar
        if is_alive:
            bx, by = card_x + 2, card_y + 50
            bw = 180
            draw.rectangle([bx, by, bx + bw, by + 5], fill=(30, 30, 30, 200))
            draw.rectangle([bx, by, bx + int(bw * hp_ratio), by + 5], fill=(*hp_color, 220))

        # Kills + tokens
        draw_text_shadow(draw, (card_x + 2, card_y + 56),
                         f"K:{kills}  {tokens:,} ARENA", FONT_SMALL, (200, 220, 255, 200))

        card_y += 82

    # ── LLM Decision overlay ──────────────────────────────────────────────────
    if decisions:
        dec_y = HEIGHT - 155
        draw.rectangle([0, dec_y - 5, WIDTH - 225, HEIGHT - 5], fill=(5, 10, 30, 200))
        draw.line([(0, dec_y - 5), (WIDTH - 225, dec_y - 5)], fill=(0, 200, 255, 80), width=1)
        draw_text_shadow(draw, (15, dec_y), "AI REASONING", FONT_SMALL, (0, 200, 255, 200))

        for i, dec in enumerate(decisions[:2]):
            agent_name = dec.get("actor", "?")
            detail = dec.get("detail", "")
            # Strip agent name prefix
            if ":" in detail:
                detail = detail.split(":", 1)[1].strip().strip('"')
            # Truncate
            max_chars = 100
            if len(detail) > max_chars:
                detail = detail[:max_chars] + "..."

            color_hex = "#ffffff"
            for a in agents_in_frame:
                if a.get("name") == agent_name:
                    color_hex = a.get("color", "#ffffff")
                    break
            color = hex_to_rgb(color_hex) if color_hex.startswith("#") else AGENT_COLORS.get(agent_name, (200, 200, 200))

            line_y = dec_y + 18 + i * 36
            draw_text_shadow(draw, (15, line_y), f"{agent_name}:", FONT_SMALL, (*color, 255))
            draw_text_shadow(draw, (15, line_y + 16), detail, FONT_SMALL, (200, 220, 255, 200))

    # ── Highlight banner ──────────────────────────────────────────────────────
    if active_highlight:
        hl = active_highlight
        hl_type = hl.get("type", "")
        hl_title = hl.get("title", "")
        hl_desc = hl.get("description", "")

        # Banner colors by type
        banner_colors = {
            "first_blood": (200, 0, 0, 220),
            "kill":        (255, 100, 0, 220),
            "clutch":      (255, 215, 0, 220),
            "multi_kill":  (255, 50, 200, 220),
        }
        banner_fill = banner_colors.get(hl_type, (50, 100, 200, 220))

        bx = WIDTH // 2 - 250
        by = HEIGHT // 2 - 60
        draw.rounded_rectangle([bx, by, bx + 500, by + 100], radius=10, fill=banner_fill)
        draw.rounded_rectangle([bx, by, bx + 500, by + 100], radius=10, outline=(255, 255, 255, 180), width=2)

        # Center text
        title_w = len(hl_title) * 18
        draw_text_shadow(draw, (WIDTH//2 - title_w//2, by + 10), hl_title, FONT_XLARGE, (255, 255, 255, 255))
        desc_w = len(hl_desc) * 8
        draw_text_shadow(draw, (WIDTH//2 - desc_w//2, by + 62), hl_desc, FONT_MED, (255, 255, 255, 220))

    # ── Footer ────────────────────────────────────────────────────────────────
    draw.rectangle([0, HEIGHT - 30, WIDTH, HEIGHT], fill=(5, 5, 25, 200))
    draw.line([(0, HEIGHT - 30), (WIDTH, HEIGHT - 30)], fill=(0, 200, 255, 60), width=1)
    footer_text = "ETHDenver 2026 • Base Sepolia • Skybox AI • OpenRouter Multi-LLM • Uniswap"
    fw = len(footer_text) * 7
    draw_text_shadow(draw, (WIDTH//2 - fw//2, HEIGHT - 22), footer_text, FONT_SMALL, (100, 150, 200, 180))

    return img.convert("RGB")


# ─── Intro / Outro frames ─────────────────────────────────────────────────────
def render_intro_frame(replay, agents_meta, frame_idx, total_intro_frames):
    """Render intro title card."""
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img, "RGBA")

    # Background gradient
    for y in range(HEIGHT):
        t = y / HEIGHT
        r = int(3 + t * 10)
        g = int(0 + t * 5)
        b = int(20 + t * 30)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b, 255))

    # Fade in
    fade_t = min(1.0, frame_idx / (total_intro_frames * 0.4))

    # Token Arena logo
    alpha = int(255 * fade_t)
    draw_text_shadow(draw, (WIDTH//2 - 200, HEIGHT//2 - 120), "TOKEN ARENA", FONT_HUGE,
                     (0, 240, 255, alpha), shadow=(0, 100, 200, alpha//2), offset=3)
    draw_text_shadow(draw, (WIDTH//2 - 180, HEIGHT//2 - 50), "AI AGENT BATTLE ARENA", FONT_LARGE,
                     (200, 200, 255, alpha))

    # Match info
    mvp = replay.get("mvpName", "?")
    kills = replay.get("totalKills", 0)
    draw_text_shadow(draw, (WIDTH//2 - 150, HEIGHT//2 + 20),
                     f"Match #{replay.get('matchId', '?')} — {kills} KILLS", FONT_MED,
                     (255, 200, 100, alpha))

    # Agent lineup
    agents = replay.get("agents", [])
    if agents and fade_t > 0.5:
        agent_fade = min(1.0, (fade_t - 0.5) * 2)
        n = len(agents)
        for i, agent in enumerate(agents):
            name = agent.get("name", "?")
            color_hex = agent.get("color", "#ffffff")
            color = hex_to_rgb(color_hex) if color_hex.startswith("#") else AGENT_COLORS.get(name, (200, 200, 200))

            # Find model
            model_label = ""
            for am in agents_meta:
                if am.get("name") == name:
                    model_label = MODEL_LABELS.get(am.get("llmModel", ""), "")
                    break

            ax = WIDTH // 2 + (i - n//2) * 220 + (110 if n % 2 == 0 else 0)
            ay = HEIGHT//2 + 80

            # Agent circle
            r_size = 30
            for r in range(r_size + 10, r_size, -2):
                a = int(agent_fade * 40)
                draw.ellipse([ax-r, ay-r, ax+r, ay+r], fill=(*color, a))
            draw.ellipse([ax-r_size, ay-r_size, ax+r_size, ay+r_size],
                         fill=(*color, int(200 * agent_fade)), outline=(255, 255, 255, int(200 * agent_fade)), width=2)

            draw_text_shadow(draw, (ax - len(name)*5, ay + r_size + 8), name, FONT_MED,
                             (*color, int(255 * agent_fade)))
            if model_label:
                draw_text_shadow(draw, (ax - len(model_label)*4, ay + r_size + 28), model_label, FONT_SMALL,
                                 (180, 200, 255, int(200 * agent_fade)))

    # VS text
    if len(agents) == 2 and fade_t > 0.6:
        vs_fade = min(1.0, (fade_t - 0.6) * 2.5)
        draw_text_shadow(draw, (WIDTH//2 - 18, HEIGHT//2 + 80), "VS", FONT_XLARGE,
                         (255, 100, 100, int(255 * vs_fade)))

    # ETHDenver badge
    if fade_t > 0.7:
        badge_fade = min(1.0, (fade_t - 0.7) * 3)
        draw.rounded_rectangle([WIDTH - 280, HEIGHT - 60, WIDTH - 10, HEIGHT - 10],
                                radius=8, fill=(20, 40, 80, int(200 * badge_fade)))
        draw_text_shadow(draw, (WIDTH - 265, HEIGHT - 50), "ETHDenver 2026", FONT_SMALL,
                         (100, 200, 255, int(220 * badge_fade)))
        draw_text_shadow(draw, (WIDTH - 265, HEIGHT - 32), "Base Sepolia L2", FONT_SMALL,
                         (150, 220, 150, int(200 * badge_fade)))

    return img.convert("RGB")


def render_outro_frame(replay, agents_meta, frame_idx, total_outro_frames):
    """Render victory/outro screen."""
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img, "RGBA")

    # Background
    for y in range(HEIGHT):
        t = y / HEIGHT
        draw.line([(0, y), (WIDTH, y)], fill=(int(5 + t*15), int(3 + t*8), int(25 + t*40), 255))

    fade_t = min(1.0, frame_idx / (total_outro_frames * 0.5))
    alpha = int(255 * fade_t)

    mvp = replay.get("mvpName", "UNKNOWN")
    mvp_kills = replay.get("mvpKills", 0)
    mvp_tokens = replay.get("mvpTokens", 0)
    total_kills = replay.get("totalKills", 0)

    # Find MVP color
    mvp_color = (255, 215, 0)
    for agent in replay.get("agents", []):
        if agent.get("name") == mvp:
            color_hex = agent.get("color", "#ffd700")
            mvp_color = hex_to_rgb(color_hex) if color_hex.startswith("#") else (255, 215, 0)
            break

    # Victory title
    draw_text_shadow(draw, (WIDTH//2 - 160, 80), "MATCH COMPLETE", FONT_XLARGE,
                     (255, 215, 0, alpha), shadow=(100, 80, 0, alpha//2), offset=3)

    # MVP section
    draw.rounded_rectangle([WIDTH//2 - 300, 160, WIDTH//2 + 300, 380], radius=15,
                            fill=(10, 20, 50, int(220 * fade_t)))
    draw.rounded_rectangle([WIDTH//2 - 300, 160, WIDTH//2 + 300, 380], radius=15,
                            outline=(*mvp_color, int(200 * fade_t)), width=3)

    draw_text_shadow(draw, (WIDTH//2 - 30, 175), "MVP", FONT_LARGE, (200, 200, 200, alpha))

    # MVP name with glow
    mvp_x = WIDTH//2 - len(mvp) * 22
    draw_text_shadow(draw, (mvp_x, 210), mvp, FONT_HUGE, (*mvp_color, alpha),
                     shadow=(mvp_color[0]//3, mvp_color[1]//3, mvp_color[2]//3, alpha//2), offset=4)

    # MVP model
    model_label = ""
    for am in agents_meta:
        if am.get("name") == mvp:
            model_label = MODEL_LABELS.get(am.get("llmModel", ""), am.get("llmModel", ""))
            break
    if model_label:
        draw_text_shadow(draw, (WIDTH//2 - len(model_label)*7, 290), f"Powered by {model_label}", FONT_MED,
                         (180, 200, 255, alpha))

    # Stats
    stats = [
        (f"{mvp_kills}", "KILLS"),
        (f"{mvp_tokens:,}", "ARENA TOKENS"),
        (f"{total_kills}", "TOTAL KILLS"),
    ]
    for i, (val, label) in enumerate(stats):
        sx = WIDTH//2 - 220 + i * 220
        draw_text_shadow(draw, (sx, 320), val, FONT_XLARGE, (255, 255, 255, alpha))
        draw_text_shadow(draw, (sx, 360), label, FONT_SMALL, (150, 180, 220, alpha))

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

    # Footer badges
    if fade_t > 0.6:
        badge_fade = min(1.0, (fade_t - 0.6) * 2.5)
        badges = [
            ("Base Sepolia", (50, 150, 255)),
            ("Skybox AI", (255, 100, 50)),
            ("OpenRouter", (100, 255, 150)),
            ("Uniswap", (255, 0, 122)),
        ]
        for i, (label, color) in enumerate(badges):
            bx = 50 + i * 200
            by = HEIGHT - 70
            draw.rounded_rectangle([bx, by, bx + 160, by + 40], radius=8,
                                    fill=(*color, int(60 * badge_fade)),
                                    outline=(*color, int(180 * badge_fade)), width=2)
            draw_text_shadow(draw, (bx + 15, by + 12), label, FONT_MED, (*color, int(255 * badge_fade)))

    return img.convert("RGB")


# ─── Main video generation ────────────────────────────────────────────────────
def generate_video(replay, agents_meta, output_path):
    """Generate a full battle recap video for one replay."""
    print(f"\n🎬 Generating video for Match {replay['matchId']} — {replay['mvpName']} wins")

    frames_data = replay.get("frames", [])
    highlights = replay.get("highlights", [])
    events = replay.get("events", [])
    combat_log = replay.get("combatLog", [])

    if not frames_data:
        print("  ⚠️  No frame data, skipping")
        return False

    # Build highlight timeline (timestamp → highlight)
    hl_timeline = {}
    for hl in highlights:
        ts = hl.get("timestamp", 0)
        dur = hl.get("duration", 3000)
        hl_timeline[ts] = (hl, dur)

    # Build decision timeline (by tick)
    decisions_by_tick = {}
    for entry in combat_log:
        if entry.get("type") == "decision":
            tick = entry.get("tick", 0)
            if tick not in decisions_by_tick:
                decisions_by_tick[tick] = []
            decisions_by_tick[tick].append(entry)

    # Build kill event timeline
    kill_events = [(e.get("timestamp", 0), e) for e in events if e.get("type") == "kill"]

    # Determine total duration
    max_ts = max((f.get("timestamp", 0) for f in frames_data), default=0)

    # Interpolate frames to FPS
    # Each game frame is ~3 seconds apart; we'll hold each for ~1.5 seconds at 30fps
    HOLD_FRAMES_PER_GAME_FRAME = 45  # 1.5s at 30fps

    INTRO_FRAMES = FPS * 3   # 3 second intro
    OUTRO_FRAMES = FPS * 4   # 4 second outro

    total_battle_frames = len(frames_data) * HOLD_FRAMES_PER_GAME_FRAME
    total_video_frames = INTRO_FRAMES + total_battle_frames + OUTRO_FRAMES

    print(f"  📊 {len(frames_data)} game frames → {total_battle_frames} battle frames + {INTRO_FRAMES} intro + {OUTRO_FRAMES} outro = {total_video_frames} total")

    # Create temp directory for frame images
    with tempfile.TemporaryDirectory() as tmpdir:
        frame_count = 0

        # ── Intro frames ──────────────────────────────────────────────────────
        print("  🎬 Rendering intro...")
        for i in range(INTRO_FRAMES):
            frame_img = render_intro_frame(replay, agents_meta, i, INTRO_FRAMES)
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

            # Check for new highlight
            for hl_ts, (hl, hl_dur) in hl_timeline.items():
                if abs(ts - hl_ts) < 5000:
                    active_highlight = hl
                    active_highlight_end = ts + hl_dur
                    break

            # Check if highlight expired
            if active_highlight and ts > active_highlight_end:
                active_highlight = None

            # Check for kill flash
            for kill_ts, kill_evt in kill_events:
                if abs(ts - kill_ts) < 3000:
                    kill_flash = {"alpha": 80, "r": 255, "g": 50, "b": 50}
                    break

            # Get decisions for this tick
            tick = gi  # approximate
            if tick in decisions_by_tick:
                current_decisions = decisions_by_tick[tick]

            # Render hold frames
            for hi in range(HOLD_FRAMES_PER_GAME_FRAME):
                # Decay kill flash
                if kill_flash["alpha"] > 0:
                    kill_flash["alpha"] = max(0, kill_flash["alpha"] - 4)

                frame_img = render_frame(
                    game_frame, replay, agents_meta,
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
            frame_img = render_outro_frame(replay, agents_meta, i, OUTRO_FRAMES)
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
    print("🎮 Token Arena — Battle Recap Video Generator")
    print("=" * 60)

    # Load replay data
    replay_file = Path("/tmp/replays.json")
    if not replay_file.exists():
        print("❌ No replay data found at /tmp/replays.json")
        sys.exit(1)

    with open(replay_file) as f:
        replays = json.load(f)

    # Load agent metadata
    agents_meta = [
        {"name": "PHANTOM",  "llmModel": "gpt-4o"},
        {"name": "NEXUS-7",  "llmModel": "claude-3-5-sonnet"},
        {"name": "TITAN",    "llmModel": "llama-3.1-70b"},
        {"name": "CIPHER",   "llmModel": "mistral-large"},
        {"name": "WRAITH",   "llmModel": "deepseek-v3"},
        {"name": "AURORA",   "llmModel": "gemini-flash"},
    ]

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    generated = []
    for i, replay in enumerate(replays):
        output_path = OUTPUT_DIR / f"battle_recap_{i+1}_{replay['mvpName'].lower()}.mp4"
        success = generate_video(replay, agents_meta, output_path)
        if success:
            generated.append({
                "file": output_path.name,
                "matchId": replay["matchId"],
                "mvpName": replay["mvpName"],
                "totalKills": replay["totalKills"],
            })

    # Write manifest
    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(generated, f, indent=2)

    print(f"\n✅ Generated {len(generated)} videos")
    for v in generated:
        print(f"  • {v['file']} — {v['mvpName']} wins, {v['totalKills']} kills")
    print(f"\n📁 Output: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
