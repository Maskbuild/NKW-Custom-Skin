package dev.custommodskin.runtime.server;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import dev.custommodskin.runtime.PngInfo;
import dev.custommodskin.runtime.SkinConfig;
import dev.custommodskin.runtime.SkinMod;
import dev.custommodskin.runtime.net.Messages;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.storage.LevelResource;

import java.io.ByteArrayOutputStream;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Server-side store + relay. Works on dedicated servers and the integrated server. Loaders call the on* hooks. */
public final class ServerSkins {
    private static final Gson GSON = new Gson();
    private static final long MIN_UPLOAD_GAP_MS = 3000;
    private static final long MIN_SPEAK_GAP_MS = 150;

    /** openHash may be null in stores written by older versions */
    private record Entry(String hash, boolean slim, String openHash) {
        String open() { return openHash == null ? "" : openHash; }
    }

    private static final class Assembly {
        final ByteArrayOutputStream out = new ByteArrayOutputStream();
        int next = 0;
        boolean slim;
        int kind;
    }

    private static final Map<UUID, Entry> players = new ConcurrentHashMap<>();
    private static final Map<UUID, Assembly> uploads = new ConcurrentHashMap<>();
    private static final Map<UUID, Long> lastUpload = new ConcurrentHashMap<>();
    private static final Map<UUID, Long> lastSpeak = new ConcurrentHashMap<>();
    private static final Map<UUID, Boolean> speaking = new ConcurrentHashMap<>();
    private static Path dir;
    private static MinecraftServer server;

    private ServerSkins() {}

    // ---- loader hooks ---------------------------------------------------------------------------

    public static void onServerStarted(MinecraftServer s) {
        server = s;
        dir = s.getWorldPath(LevelResource.ROOT).resolve("skinmod");
        players.clear();
        try {
            Files.createDirectories(dir);
            Path idx = dir.resolve("players.json");
            if (Files.exists(idx)) {
                try (Reader r = Files.newBufferedReader(idx)) {
                    Map<String, Entry> m = GSON.fromJson(r, new TypeToken<Map<String, Entry>>() {}.getType());
                    if (m != null) m.forEach((k, v) -> players.put(UUID.fromString(k), v));
                }
            }
        } catch (Exception e) {
            SkinMod.LOGGER.warn("Failed to load skin store", e);
        }
    }

    public static void onServerStopping() {
        save();
        server = null;
    }

    public static void onJoin(ServerPlayer joiner) {
        if (server == null || !SkinMod.platform.net().canSendToPlayer(joiner, Messages.Announce.class)) return;
        // tell the joiner about everybody online who has a custom skin
        for (ServerPlayer p : server.getPlayerList().getPlayers()) {
            Entry e = players.get(p.getUUID());
            if (e != null) SkinMod.platform.net().toPlayer(joiner, new Messages.Announce(p.getUUID(), e.hash(), e.slim(), e.open()));
        }
        // and tell everyone about the joiner
        Entry mine = players.get(joiner.getUUID());
        if (mine != null) broadcast(joiner.getUUID(), mine);
    }

    public static void onDisconnect(ServerPlayer player) {
        UUID id = player.getUUID();
        uploads.remove(id);
        lastUpload.remove(id);
        lastSpeak.remove(id);
        if (speaking.remove(id) != null) broadcastSpeak(id, false);
    }

    // ---- packet handlers ------------------------------------------------------------------------

    public static void onReset(Messages.Reset msg, ServerPlayer player) {
        UUID id = player.getUUID();
        uploads.remove(id);
        if (players.remove(id) == null) return;
        save();
        broadcast(id, new Entry("", false, ""));
    }

    public static void onSpeak(Messages.Speak msg, ServerPlayer player) {
        UUID id = player.getUUID();
        long t = System.currentTimeMillis();
        Long last = lastSpeak.get(id);
        if (last != null && t - last < MIN_SPEAK_GAP_MS) return; // flapping protection
        lastSpeak.put(id, t);
        Boolean was = speaking.put(id, msg.speaking());
        if (was == null ? !msg.speaking() : was == msg.speaking()) return;
        broadcastSpeak(id, msg.speaking());
    }

    public static void onUpload(Messages.Upload up, ServerPlayer player) {
        UUID id = player.getUUID();
        if (dir == null || up.total() <= 0 || up.total() > SkinConfig.MAX_UPLOAD_BYTES / 1000) return;
        if (up.kind() != 0 && up.kind() != 1) return;
        if (up.index() == 0) {
            if (up.kind() == 0) {
                long now = System.currentTimeMillis();
                Long last = lastUpload.get(id);
                if (last != null && now - last < MIN_UPLOAD_GAP_MS) { uploads.remove(id); return; }
                lastUpload.put(id, now);
            } else if (!players.containsKey(id)) {
                return; // a talking skin needs a main skin first
            }
            Assembly fresh = new Assembly();
            fresh.slim = up.slim();
            fresh.kind = up.kind();
            uploads.put(id, fresh);
        }
        Assembly a = uploads.get(id);
        if (a == null || a.next != up.index() || a.kind != up.kind()) { uploads.remove(id); return; }
        if (a.out.size() + up.data().length > SkinConfig.MAX_UPLOAD_BYTES) { uploads.remove(id); return; }
        a.out.writeBytes(up.data());
        a.next++;
        if (a.next < up.total()) return;

        uploads.remove(id);
        byte[] png = a.out.toByteArray();
        PngInfo info = PngInfo.read(png);
        if (info == null || !info.supported()) {
            SkinMod.LOGGER.warn("Rejected skin upload from {}", player.getName().getString());
            return;
        }
        try {
            String hash = sha256(png);
            Path f = dir.resolve(hash + ".png");
            if (!Files.exists(f)) Files.write(f, png);
            Entry cur = players.get(id);
            Entry e = a.kind == 0 ? new Entry(hash, a.slim, "") : new Entry(cur.hash(), cur.slim(), hash);
            players.put(id, e);
            save();
            broadcast(id, e);
        } catch (Exception ex) {
            SkinMod.LOGGER.warn("Failed to store skin", ex);
        }
    }

    public static void onRequest(Messages.Request req, ServerPlayer player) {
        String hash = req.hash();
        if (dir == null || !PngInfo.validHash(hash)) return;
        Path f = dir.resolve(hash + ".png");
        try {
            if (!Files.exists(f)) return;
            byte[] png = Files.readAllBytes(f);
            int total = (png.length + Messages.DOWNLOAD_CHUNK - 1) / Messages.DOWNLOAD_CHUNK;
            for (int i = 0; i < total; i++) {
                int from = i * Messages.DOWNLOAD_CHUNK;
                int to = Math.min(png.length, from + Messages.DOWNLOAD_CHUNK);
                SkinMod.platform.net().toPlayer(player, new Messages.Download(hash, i, total, Arrays.copyOfRange(png, from, to)));
            }
        } catch (Exception e) {
            SkinMod.LOGGER.warn("Failed to send skin {}", hash, e);
        }
    }

    // ---- helpers --------------------------------------------------------------------------------

    private static void save() {
        if (dir == null) return;
        try {
            Map<String, Entry> m = new HashMap<>();
            players.forEach((k, v) -> m.put(k.toString(), v));
            Files.writeString(dir.resolve("players.json"), GSON.toJson(m));
        } catch (Exception e) {
            SkinMod.LOGGER.warn("Failed to save skin store", e);
        }
    }

    private static void broadcast(UUID who, Entry e) {
        if (server == null) return;
        var msg = new Messages.Announce(who, e.hash(), e.slim(), e.open());
        for (ServerPlayer p : server.getPlayerList().getPlayers()) {
            if (SkinMod.platform.net().canSendToPlayer(p, Messages.Announce.class)) SkinMod.platform.net().toPlayer(p, msg);
        }
    }

    private static void broadcastSpeak(UUID who, boolean now) {
        if (server == null) return;
        var msg = new Messages.SpeakState(who, now);
        for (ServerPlayer p : server.getPlayerList().getPlayers()) {
            if (SkinMod.platform.net().canSendToPlayer(p, Messages.SpeakState.class)) SkinMod.platform.net().toPlayer(p, msg);
        }
    }

    private static String sha256(byte[] data) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(data);
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
