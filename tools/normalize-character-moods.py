"""
NORMALIZE-CHARACTER-MOODS.PY
============================

Ensarter farvemætning og hvidbalance mellem en karakters BG-hero-portrætter.
Hver karakter bruger sit neutrale app-ikon som reference, fordi figurens hud,
hår og tøj er de samme i alle humørbilleder. Dermed fjernes forskelle fra
billedgenerationens skiftende lys uden at tvinge seks forskellige karakterer
ind i den samme globale farveprofil.

Scriptet er et udviklingsværktøj og indgår ikke i simulatorens runtime.
Det kræver Pillow og overskriver kun PNG-filer i assets/characters/*/moods/.
Git-checkpointet før kørsel gør ændringen fuldt reversibel.
"""

from __future__ import annotations

import colorsys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
APP_ICON_DIR = PROJECT_ROOT / "assets" / "icons" / "app"
CHARACTER_DIR = PROJECT_ROOT / "assets" / "characters"
CHARACTER_IDS = ("oscar", "emma", "erik", "laura", "frank", "ruth")


@dataclass(frozen=True)
class ColourStats:
    """Alfavægtede gennemsnit for den synlige del af et portræt."""

    red: float
    green: float
    blue: float
    saturation: float


def measure_colour(image: Image.Image) -> ColourStats:
    """Mål RGB og HSV-mætning uden at lade transparente pixels tælle med."""

    rgba = image.convert("RGBA")
    weight_sum = red_sum = green_sum = blue_sum = saturation_sum = 0.0

    for red, green, blue, alpha in rgba.get_flattened_data():
        if alpha == 0:
            continue
        weight = alpha / 255.0
        saturation = colorsys.rgb_to_hsv(red / 255.0, green / 255.0, blue / 255.0)[1]
        weight_sum += weight
        red_sum += red * weight
        green_sum += green * weight
        blue_sum += blue * weight
        saturation_sum += saturation * weight

    if weight_sum == 0:
        raise ValueError("Portrættet indeholder ingen synlige pixels")

    return ColourStats(
        red=red_sum / weight_sum,
        green=green_sum / weight_sum,
        blue=blue_sum / weight_sum,
        saturation=saturation_sum / weight_sum,
    )


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def apply_channel_gains(image: Image.Image, target: ColourStats) -> Image.Image:
    """Skalér RGB-kanaler, så portrættets gennemsnitsfarve matcher referencen."""

    current = measure_colour(image)
    gains = (
        clamp(target.red / max(current.red, 1.0), 0.75, 1.25),
        clamp(target.green / max(current.green, 1.0), 0.75, 1.25),
        clamp(target.blue / max(current.blue, 1.0), 0.75, 1.25),
    )
    red, green, blue, alpha = image.convert("RGBA").split()
    corrected = [
        channel.point([round(clamp(value * gain, 0, 255)) for value in range(256)])
        for channel, gain in zip((red, green, blue), gains)
    ]
    return Image.merge("RGBA", (*corrected, alpha))


def apply_saturation(image: Image.Image, target: ColourStats) -> Image.Image:
    """Justér kun farveafstanden fra grå; luminans og alfa bevares."""

    current = measure_colour(image)
    factor = clamp(target.saturation / max(current.saturation, 0.01), 0.70, 1.40)
    rgba = image.convert("RGBA")
    rgb = rgba.convert("RGB")
    gray = rgb.convert("L").convert("RGB")
    adjusted_rgb = Image.blend(gray, rgb, factor)
    adjusted_rgb.putalpha(rgba.getchannel("A"))
    return adjusted_rgb


def normalise_portrait(image: Image.Image, target: ColourStats) -> Image.Image:
    """To korte iterationer giver stabil mætning og kanalbalance uden hårde spring."""

    corrected = image.convert("RGBA")
    for _ in range(2):
        corrected = apply_saturation(corrected, target)
        corrected = apply_channel_gains(corrected, target)
    return corrected


def main() -> None:
    for character_id in CHARACTER_IDS:
        reference_path = APP_ICON_DIR / f"character-{character_id}.png"
        target = measure_colour(Image.open(reference_path))
        mood_dir = CHARACTER_DIR / character_id / "moods"

        for mood_path in sorted(mood_dir.glob("*.png")):
            source = Image.open(mood_path)
            corrected = normalise_portrait(source, target)
            corrected.save(mood_path, format="PNG", optimize=True)

        print(
            f"{character_id}: target saturation={target.saturation:.3f}, "
            f"RGB=({target.red:.1f}, {target.green:.1f}, {target.blue:.1f})"
        )


if __name__ == "__main__":
    main()
