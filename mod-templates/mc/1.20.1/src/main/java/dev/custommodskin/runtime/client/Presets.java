package dev.custommodskin.runtime.client;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.custommodskin.runtime.SkinMod;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;

/** Skins shipped inside the jar (Skin nodes in the launcher). Read-only for the player. */
public final class Presets {
    private static List<Wardrobe.Outfit> cache;

    private Presets() {}

    public static List<Wardrobe.Outfit> list() {
        if (cache != null) return cache;
        List<Wardrobe.Outfit> out = new ArrayList<>();
        try (InputStream in = Presets.class.getResourceAsStream("/assets/skinmod/presets/index.json")) {
            if (in != null) {
                JsonArray arr = new Gson().fromJson(new InputStreamReader(in, StandardCharsets.UTF_8), JsonArray.class);
                for (JsonElement e : arr) {
                    JsonObject o = e.getAsJsonObject();
                    String id = o.get("id").getAsString();
                    try (InputStream png = Presets.class.getResourceAsStream("/assets/skinmod/presets/" + id + ".png")) {
                        if (png == null) continue;
                        byte[] data = png.readAllBytes();
                        Wardrobe.Outfit f = new Wardrobe.Outfit();
                        f.id = "preset:" + id;
                        f.name = o.has("name") ? o.get("name").getAsString() : id;
                        f.slim = o.has("slim") && o.get("slim").getAsBoolean();
                        f.hash = sha256(data);
                        f.preset = true;
                        f.data = data;
                        out.add(f);
                    }
                }
            }
        } catch (Exception e) {
            SkinMod.LOGGER.warn("Could not read preset skins", e);
        }
        return cache = out;
    }

    private static String sha256(byte[] data) throws Exception {
        StringBuilder sb = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(data)) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
