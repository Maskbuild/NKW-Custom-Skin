package dev.custommodskin.runtime.client;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import dev.custommodskin.runtime.PngInfo;
import dev.custommodskin.runtime.SkinConfig;
import dev.custommodskin.runtime.SkinMod;
import net.minecraft.client.Minecraft;

import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** The player saved outfits (config/skinmod/wardrobe) plus the skins shipped inside the mod. */
public final class Wardrobe {
    public static final class Outfit {
        public String id;
        public String name;
        public String hash;
        public boolean slim;
        /** folder name inside figura/avatars, "" = none (the current Figura avatar stays) */
        public String figura = "";
        /** hash of the talking (mouth-open) skin, "" = none */
        public String openHash = "";
        /** shipped inside the mod: not saved in the index, cannot be edited or deleted */
        public transient boolean preset;
        public transient byte[] data;
    }

    private static final class Index {
        List<Outfit> outfits = new ArrayList<>();
        String selected = "";
    }

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static Index index;

    private Wardrobe() {}

    private static Path dir() {
        Path p = SkinMod.platform.configDir().resolve("skinmod").resolve("wardrobe");
        try { Files.createDirectories(p); } catch (Exception ignored) {}
        return p;
    }

    private static Index idx() {
        if (index != null) return index;
        index = new Index();
        Path f = dir().resolve("index.json");
        try {
            if (Files.exists(f)) {
                try (Reader r = Files.newBufferedReader(f)) {
                    Index loaded = GSON.fromJson(r, Index.class);
                    if (loaded != null && loaded.outfits != null) index = loaded;
                }
            }
        } catch (Exception e) {
            SkinMod.LOGGER.warn("Failed to read wardrobe", e);
        }
        for (Outfit o : index.outfits) {
            if (o.figura == null) o.figura = "";
            if (o.openHash == null) o.openHash = "";
        }
        return index;
    }

    private static void save() {
        try { Files.writeString(dir().resolve("index.json"), GSON.toJson(idx())); }
        catch (Exception e) { SkinMod.LOGGER.warn("Failed to save wardrobe", e); }
    }

    private static List<Outfit> allCache;

    /** Preset skins first, then the player own outfits. Cached: the screen asks for it many times per frame. */
    public static List<Outfit> list() {
        if (allCache == null) {
            List<Outfit> all = new ArrayList<>(Presets.list());
            all.addAll(idx().outfits);
            allCache = java.util.Collections.unmodifiableList(all);
        }
        return allCache;
    }

    public static Outfit selected() {
        for (Outfit o : list()) if (o.id.equals(idx().selected)) return o;
        return null;
    }

    public static boolean full() {
        int max = SkinConfig.maxSkins();
        return max >= 0 && idx().outfits.size() >= max; // presets do not count
    }

    public static int ownCount() { return idx().outfits.size(); }

    public static byte[] bytes(Outfit o) throws Exception {
        if (o.preset) return o.data;
        return Files.readAllBytes(dir().resolve(o.hash + ".png"));
    }

    public static byte[] openBytes(Outfit o) {
        if (o.openHash.isEmpty()) return null;
        try { return Files.readAllBytes(dir().resolve(o.openHash + ".png")); } catch (Exception e) { return null; }
    }

    private static String store(byte[] data) throws Exception {
        StringBuilder sb = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(data)) sb.append(String.format("%02x", b));
        String hash = sb.toString();
        Files.write(dir().resolve(hash + ".png"), data);
        return hash;
    }

    /** @return error code ("limit", "bad_size:W:H", "error"), or null on success. */
    public static String add(Path png) {
        try {
            if (full()) return "limit";
            byte[] data = Files.readAllBytes(png);
            PngInfo info = PngInfo.read(data);
            if (info == null || !info.supported()) {
                return info == null ? "bad_size:?:?" : "bad_size:" + info.width + ":" + info.height;
            }
            Outfit o = new Outfit();
            o.id = UUID.randomUUID().toString();
            String n = png.getFileName().toString();
            o.name = n.toLowerCase().endsWith(".png") ? n.substring(0, n.length() - 4) : n;
            o.hash = store(data);
            idx().outfits.add(o);
            allCache = null;
            save();
            return null;
        } catch (Exception e) {
            SkinMod.LOGGER.warn("Failed to add skin", e);
            return "error";
        }
    }

    /** Sets (or with null clears) the talking skin of an outfit. Same error codes as {@link #add}. */
    public static String setOpen(Outfit o, Path png) {
        if (o.preset) return "error";
        try {
            if (png == null) {
                o.openHash = "";
            } else {
                byte[] data = Files.readAllBytes(png);
                PngInfo info = PngInfo.read(data);
                if (info == null || !info.supported()) return info == null ? "bad_size:?:?" : "bad_size:" + info.width + ":" + info.height;
                o.openHash = store(data);
            }
            save();
            return null;
        } catch (Exception e) {
            SkinMod.LOGGER.warn("Failed to set talking skin", e);
            return "error";
        }
    }

    public static void remove(Outfit o) {
        if (o.preset) return;
        idx().outfits.remove(o);
        allCache = null;
        if (o.id.equals(idx().selected)) idx().selected = "";
        for (String h : new String[]{o.hash, o.openHash}) {
            if (h.isEmpty()) continue;
            boolean used = idx().outfits.stream().anyMatch(x -> x.hash.equals(h) || x.openHash.equals(h));
            if (!used) { try { Files.deleteIfExists(dir().resolve(h + ".png")); } catch (Exception ignored) {} }
        }
        save();
    }

    public static void rename(Outfit o, String name) { if (!o.preset) { o.name = name; save(); } }
    public static void setSlim(Outfit o, boolean slim) { if (!o.preset) { o.slim = slim; save(); } }
    public static void setFigura(Outfit o, String avatar) { if (!o.preset) { o.figura = avatar == null ? "" : avatar; save(); } }

    /** Marks the outfit as worn, shows it locally, uploads it, and switches the Figura avatar if one is set. */
    public static void apply(Outfit o) {
        try {
            byte[] png = bytes(o);
            byte[] open = openBytes(o);
            idx().selected = o.id;
            save();
            Minecraft mc = Minecraft.getInstance();
            if (mc.player != null) ClientSkins.setOwn(mc.player.getUUID(), o.hash, png, o.slim, open != null ? o.openHash : "", open);
            ClientSkins.upload(png, o.slim, 0);
            if (open != null) ClientSkins.upload(open, o.slim, 1);
            if (SkinConfig.figuraEnabled() && !o.figura.isEmpty()) FiguraBridge.load(o.figura, true);
            Toasts.show("Skin applied", o.name);
        } catch (Exception e) {
            SkinMod.LOGGER.warn("Failed to apply skin", e);
        }
    }

    /** Stops wearing any outfit: the normal Minecraft skin shows again, for everyone. */
    public static void reset() {
        idx().selected = "";
        save();
        Minecraft mc = Minecraft.getInstance();
        if (mc.player != null) ClientSkins.resetOwn(mc.player.getUUID());
        Toasts.show("Skin reset", "You are using your Minecraft skin again");
    }

    public static boolean wearingAny() { return selected() != null; }

    public static void applySelected() {
        Outfit o = selected();
        if (o != null) apply(o);
    }
}
