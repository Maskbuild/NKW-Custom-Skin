package dev.custommodskin.runtime;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/** Feature switches baked into the jar by the launcher exporter (skinmod.config.json). */
public final class SkinConfig {
    public static final int MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
    public static final int MAX_ZONE = 256;

    private static JsonObject root = new JsonObject();

    static {
        try (var in = SkinConfig.class.getResourceAsStream("/skinmod.config.json")) {
            if (in != null) {
                try (Reader r = new InputStreamReader(in, StandardCharsets.UTF_8)) {
                    root = new Gson().fromJson(r, JsonObject.class);
                }
            }
        } catch (Exception e) {
            SkinMod.LOGGER.warn("Could not read skinmod.config.json, using defaults", e);
        }
    }

    private SkinConfig() {}

    /** -1 means unlimited. */
    public static int maxSkins() {
        return root.has("maxSkins") ? root.get("maxSkins").getAsInt() : 10;
    }

    public static boolean keyEnabled() {
        JsonObject k = obj("key");
        return k == null || !k.has("enabled") || k.get("enabled").getAsBoolean();
    }

    /** GLFW key name like "K" or "F7"; falls back to K. */
    public static String defaultKey() {
        JsonObject k = obj("key");
        return k != null && k.has("default") ? k.get("default").getAsString() : "K";
    }

    /** A block that opens the wardrobe: a game block (vanilla = its id) or a new block of ours (id). */
    public record BlockEntry(String id, String vanilla, String name) {}

    /** The built-in Skin Station block exists when the skin block is on and no Block node is connected. */
    public static boolean builtinStation() {
        JsonObject b = obj("block");
        return blockEnabled() && (b == null || !b.has("builtin") || b.get("builtin").getAsBoolean());
    }

    public static List<BlockEntry> blocks() {
        List<BlockEntry> out = new ArrayList<>();
        JsonObject b = obj("block");
        if (b == null || !b.has("entries") || !b.get("entries").isJsonArray()) return out;
        JsonArray arr = b.getAsJsonArray("entries");
        for (JsonElement e : arr) {
            if (!e.isJsonObject()) continue;
            JsonObject o = e.getAsJsonObject();
            String id = o.has("id") ? o.get("id").getAsString() : "";
            String vanilla = o.has("vanilla") ? o.get("vanilla").getAsString() : "";
            if (id.isEmpty() && vanilla.isEmpty()) continue;
            out.add(new BlockEntry(id, vanilla, o.has("name") ? o.get("name").getAsString() : id));
        }
        return out;
    }

    public static String blockMessage() {
        JsonObject b = obj("block");
        return b != null && b.has("message") && !b.get("message").getAsString().isBlank() ? b.get("message").getAsString() : "Right-click to change your skin";
    }

    public static boolean blockEnabled() {
        JsonObject b = obj("block");
        return b != null && b.has("enabled") && b.get("enabled").getAsBoolean();
    }

    public static String blockName() {
        JsonObject b = obj("block");
        return b != null && b.has("name") ? b.get("name").getAsString() : "Skin Station";
    }

    public static boolean figuraEnabled() {
        JsonObject f = obj("figura");
        return f != null && f.has("enabled") && f.get("enabled").getAsBoolean();
    }

    public static boolean plasmoEnabled() {
        JsonObject p = obj("plasmo");
        return p != null && p.has("enabled") && p.get("enabled").getAsBoolean();
    }

    public static boolean zoneEnabled() {
        JsonObject z = obj("zone");
        return z != null && z.has("enabled") && z.get("enabled").getAsBoolean();
    }

    /** "hint" (message on the hotbar, key opens the window) or "instant" (window opens on entering). */
    public static String zoneMode() {
        JsonObject z = obj("zone");
        return z != null && z.has("mode") ? z.get("mode").getAsString() : "hint";
    }

    public static String zoneMessage() {
        JsonObject z = obj("zone");
        return z != null && z.has("message") ? z.get("message").getAsString() : "Press {{button}} to change your skin";
    }

    public static int zoneDefault(String axis) {
        JsonObject z = obj("zone");
        int fallback = axis.equals("height") ? 4 : 8;
        return z != null && z.has(axis) ? Math.max(1, Math.min(MAX_ZONE, z.get(axis).getAsInt())) : fallback;
    }

    private static JsonObject obj(String name) {
        return root.has(name) && root.get(name).isJsonObject() ? root.getAsJsonObject(name) : null;
    }
}
