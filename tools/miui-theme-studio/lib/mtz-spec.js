/* Constants for the MIUI/HyperOS .mtz theme format and the Xiaomi 14T Pro.
   Pure data — no DOM, no state. Shared by the editor, builder and parser. */

// Target device. 14T Pro panel is 1.5K (1220×2712), ~20:9.
export const DEVICE = Object.freeze({
  name: "Xiaomi 14T Pro",
  width: 1220,
  height: 2712,
});

// uiVersion 14 covers MIUI 14 + HyperOS, which is what the 14T Pro ships.
export const DEFAULT_UI_VERSION = 14;

// Icons are 192×192 PNG-24 with transparency in classic MIUI theme packs.
export const ICON_SIZE = 192;

// System packages whose nested ZIP we recognise on import and offer on build.
// Any other package name is allowed too (free-form input).
export const KNOWN_PACKAGES = Object.freeze([
  "com.android.systemui",
  "framework-res",
  "framework-miui-res",
  "com.miui.home",
  "com.android.settings",
  "com.android.contacts",
  "com.android.mms",
  "com.android.deskclock",
]);

// Drawable density buckets a theme may override. xxhdpi is the safe default
// for a high-density device like the 14T Pro.
export const DRAWABLE_DENSITIES = Object.freeze([
  "drawable-xxxhdpi",
  "drawable-xxhdpi",
  "drawable-xhdpi",
  "drawable-hdpi",
  "drawable",
]);

// A small curated palette of theme_values color names that HyperOS commonly
// honours, grouped by package, to seed the color editor. Unknown names are
// allowed — HyperOS simply ignores ones it doesn't use.
export const COLOR_PRESETS = Object.freeze({
  "com.android.systemui": [
    "status_bar_clock_color",
    "status_bar_battery_text_color",
    "notification_title_color",
    "notification_text_color",
    "notification_bg_color",
    "control_center_bg_color",
    "qs_tile_text_color",
  ],
  "framework-res": [
    "window_background",
    "primary_text_color",
    "accent_color",
  ],
  "com.miui.home": [
    "workspace_text_color",
    "folder_bg_color",
    "all_apps_bg_color",
  ],
});

// Common apps offered as quick "slots" in the icon editor. The value is the
// file basename written into the `icons` archive (package or component name).
export const PRESET_APPS = Object.freeze([
  { label: "Phone", pkg: "com.android.contacts" },
  { label: "Messages", pkg: "com.android.mms" },
  { label: "Camera", pkg: "com.android.camera" },
  { label: "Gallery", pkg: "com.miui.gallery" },
  { label: "Settings", pkg: "com.android.settings" },
  { label: "Clock", pkg: "com.android.deskclock" },
  { label: "Calculator", pkg: "com.miui.calculator" },
  { label: "Files", pkg: "com.android.fileexplorer" },
  { label: "Chrome", pkg: "com.android.chrome" },
  { label: "Play Store", pkg: "com.android.vending" },
  { label: "Gmail", pkg: "com.google.android.gm" },
  { label: "YouTube", pkg: "com.google.android.youtube" },
  { label: "Maps", pkg: "com.google.android.apps.maps" },
  { label: "WhatsApp", pkg: "com.whatsapp" },
  { label: "Spotify", pkg: "com.spotify.music" },
  { label: "Instagram", pkg: "com.instagram.android" },
]);

export const MIME = Object.freeze({
  jpg: "image/jpeg",
  png: "image/png",
  ttf: "font/ttf",
});

// Safety cap for imports — total uncompressed bytes we will accept.
export const MAX_IMPORT_BYTES = 256 * 1024 * 1024;
