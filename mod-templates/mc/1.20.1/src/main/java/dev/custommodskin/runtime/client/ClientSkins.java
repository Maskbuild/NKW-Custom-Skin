package dev.custommodskin.runtime.client;

import com.mojang.blaze3d.platform.NativeImage;
import dev.custommodskin.runtime.PngInfo;
import dev.custommodskin.runtime.SkinMod;
import dev.custommodskin.runtime.net.Messages;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.ResourceLocation;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Client-side registry of HD skins: who uses what, texture loading, and network transfer. */
public final class ClientSkins {
    /** openHash is "" when the player has no talking skin */
    public record Use(String hash, boolean slim, String openHash) {
        public Use(String hash, boolean slim) { this(hash, slim, ""); }
    }

    private static final Map<UUID, Use> uses = new ConcurrentHashMap<>();
    private static final Set<UUID> speaking = ConcurrentHashMap.newKeySet();
    private static final Map<String, ResourceLocation> textures = new ConcurrentHashMap<>();
    private static final Map<String, int[]> sizes = new ConcurrentHashMap<>();
    private static final Map<String, ByteArrayOutputStream> downloading = new ConcurrentHashMap<>();
    private static final Set<String> requested = new HashSet<>();
    private static volatile Use preview; // shown on the local player while the wardrobe is open
    private static boolean localSpeaking;

    private ClientSkins() {}

    public static Path cacheDir() {
        Path p = SkinMod.platform.configDir().resolve("skinmod").resolve("cache");
        try { Files.createDirectories(p); } catch (Exception ignored) {}
        return p;
    }

    // ---- lookup used by the mixin -------------------------------------------------------------

    /** The use that applies to this player right now (the preview for the local player while the wardrobe is open). */
    private static Use current(UUID player) {
        Minecraft mc = Minecraft.getInstance();
        boolean self = mc.player != null && mc.player.getUUID().equals(player);
        Use use = (self && preview != null) ? preview : uses.get(player);
        return use == null || use.hash().isEmpty() ? null : use;
    }

    /** Skin texture to draw for a player, or `base` when they have no custom skin (yet). */
    public static ResourceLocation overrideTexture(UUID player, ResourceLocation base) {
        Use use = current(player);
        if (use == null) return base;
        String hash = use.hash();
        if (!use.openHash().isEmpty() && speaking.contains(player) && textures.containsKey(use.openHash())) hash = use.openHash();
        ResourceLocation tex = textures.get(hash);
        return tex != null ? tex : base;
    }

    /** "slim" or "default" (Minecraft's names for the arm models). */
    public static String overrideModel(UUID player, String base) {
        Use use = current(player);
        if (use == null || !textures.containsKey(use.hash())) return base;
        return use.slim() ? "slim" : "default";
    }

    public static boolean isRegistered(String hash) { return textures.containsKey(hash); }

    /** Texture of a registered skin, or null while it is still loading. */
    public static ResourceLocation textureOf(String hash) { return textures.get(hash); }

    /** {width, height} of a registered skin, or null. */
    public static int[] sizeOf(String hash) { return sizes.get(hash); }

    // ---- network events -----------------------------------------------------------------------

    public static void onAnnounce(Messages.Announce a) {
        if (a.hash().isEmpty()) { uses.remove(a.player()); return; }
        // the hash names files in the cache folder, so a server must not be able to send anything else
        if (!PngInfo.validHash(a.hash()) || !(a.openHash().isEmpty() || PngInfo.validHash(a.openHash()))) return;
        uses.put(a.player(), new Use(a.hash(), a.slim(), a.openHash()));
        ensureTexture(a.hash());
        if (!a.openHash().isEmpty()) ensureTexture(a.openHash());
    }

    public static void onSpeakState(Messages.SpeakState s) {
        if (s.speaking()) speaking.add(s.player()); else speaking.remove(s.player());
    }

    public static void onDownload(Messages.Download d) {
        if (!PngInfo.validHash(d.hash()) || !requested.contains(d.hash())) return; // only what we asked for
        ByteArrayOutputStream buf = downloading.computeIfAbsent(d.hash(), k -> new ByteArrayOutputStream());
        if (d.index() == 0) buf.reset();
        buf.writeBytes(d.data());
        if (d.index() + 1 < d.total()) return;
        downloading.remove(d.hash());
        byte[] png = buf.toByteArray();
        PngInfo info = PngInfo.read(png);
        if (info == null || !info.supported()) return;
        try { Files.write(cacheDir().resolve(d.hash() + ".png"), png); } catch (Exception ignored) {}
        registerTexture(d.hash(), png);
    }

    public static void reset() {
        uses.clear();
        speaking.clear();
        requested.clear();
        downloading.clear();
        preview = null;
        localSpeaking = false;
    }

    private static void ensureTexture(String hash) {
        if (textures.containsKey(hash)) return;
        Path cached = cacheDir().resolve(hash + ".png");
        try {
            if (Files.exists(cached)) { registerTexture(hash, Files.readAllBytes(cached)); return; }
        } catch (Exception ignored) {}
        if (requested.add(hash) && SkinMod.platform.net().canSendToServer(Messages.Request.class)) {
            SkinMod.platform.net().toServer(new Messages.Request(hash));
        }
    }

    // ---- textures -----------------------------------------------------------------------------

    /** Registers PNG bytes as a GL texture (any supported size). Safe to call from any thread. */
    public static ResourceLocation registerTexture(String hash, byte[] png) {
        ResourceLocation existing = textures.get(hash);
        if (existing != null) return existing;
        ResourceLocation id = SkinMod.id("skin/" + hash);
        Minecraft mc = Minecraft.getInstance();
        mc.execute(() -> {
            if (textures.containsKey(hash)) return;
            try {
                NativeImage img = NativeImage.read(new ByteArrayInputStream(png));
                sizes.put(hash, new int[]{img.getWidth(), img.getHeight()});
                mc.getTextureManager().register(id, new DynamicTexture(img));
                textures.put(hash, id);
            } catch (Exception e) {
                SkinMod.LOGGER.warn("Failed to load skin texture {}", hash, e);
            }
        });
        return id;
    }

    public static void setPreview(Use use) { preview = use; }

    // ---- upload / local state -----------------------------------------------------------------

    public static void upload(byte[] png, boolean slim, int kind) {
        if (!SkinMod.platform.net().canSendToServer(Messages.Upload.class)) return;
        int total = (png.length + Messages.UPLOAD_CHUNK - 1) / Messages.UPLOAD_CHUNK;
        for (int i = 0; i < total; i++) {
            int from = i * Messages.UPLOAD_CHUNK;
            int to = Math.min(png.length, from + Messages.UPLOAD_CHUNK);
            SkinMod.platform.net().toServer(new Messages.Upload(i, total, slim, kind, Arrays.copyOfRange(png, from, to)));
        }
    }

    /** Use a skin locally right away (also covers single-player without waiting for the server echo). */
    public static void setOwn(UUID self, String hash, byte[] png, boolean slim, String openHash, byte[] openPng) {
        registerTexture(hash, png);
        if (!openHash.isEmpty() && openPng != null) registerTexture(openHash, openPng);
        uses.put(self, new Use(hash, slim, openHash));
    }

    /** Back to the normal Minecraft skin, for everyone. */
    public static void resetOwn(UUID self) {
        uses.remove(self);
        speaking.remove(self);
        if (SkinMod.platform.net().canSendToServer(Messages.Reset.class)) SkinMod.platform.net().toServer(new Messages.Reset());
    }

    /** Called every tick by the Plasmo Voice bridge; sends a packet only when the state changes. */
    public static void setLocalSpeaking(boolean now) {
        if (now == localSpeaking) return;
        localSpeaking = now;
        Minecraft mc = Minecraft.getInstance();
        if (mc.player != null) {
            if (now) speaking.add(mc.player.getUUID()); else speaking.remove(mc.player.getUUID());
        }
        if (SkinMod.platform.net().canSendToServer(Messages.Speak.class)) SkinMod.platform.net().toServer(new Messages.Speak(now));
    }
}
