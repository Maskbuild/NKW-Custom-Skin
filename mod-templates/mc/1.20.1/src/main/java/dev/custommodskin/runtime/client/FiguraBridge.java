package dev.custommodskin.runtime.client;

import dev.custommodskin.runtime.SkinMod;
import net.minecraft.client.Minecraft;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Optional Figura support. Nothing here is linked at compile time: Figura classes are reached by reflection so the
 * mod runs (and the buttons hide) when Figura is not installed. Every call is wrapped; a Figura update that renames
 * something only disables this feature, it never crashes the game.
 */
public final class FiguraBridge {
    private static final String MANAGER = "org.figuramc.figura.avatar.AvatarManager";
    private static final String LOADER = "org.figuramc.figura.avatar.local.LocalAvatarLoader";
    private static final String NETWORK = "org.figuramc.figura.backend2.NetworkStuff";

    private static int pendingUpload = -1; // ticks left to wait for the avatar to finish loading

    private FiguraBridge() {}

    public static boolean installed() { return SkinMod.platform.isModLoaded("figura"); }

    public static Path avatarsDir() { return SkinMod.platform.gameDir().resolve("figura").resolve("avatars"); }

    /** Names of the avatar folders (and .moon files) the player has in figura/avatars. */
    public static List<String> list() {
        List<String> out = new ArrayList<>();
        Path d = avatarsDir();
        if (!Files.isDirectory(d)) return out;
        try (Stream<Path> s = Files.list(d)) {
            s.filter(p -> Files.isDirectory(p) || p.getFileName().toString().endsWith(".moon"))
                    .map(p -> p.getFileName().toString()).filter(n -> !n.startsWith(".")).sorted(String.CASE_INSENSITIVE_ORDER).forEach(out::add);
        } catch (Exception e) {
            SkinMod.LOGGER.warn("Could not list Figura avatars", e);
        }
        return out;
    }

    /** The avatar Figura currently has loaded from disk, or null. */
    public static Path current() {
        if (!installed()) return null;
        try {
            Object p = Class.forName(LOADER).getMethod("getLastLoadedPath").invoke(null);
            return p instanceof Path path ? path : null;
        } catch (Throwable t) {
            return null;
        }
    }

    /** Loads a local avatar; with {@code upload} it is also sent to the Figura backend so other players see it. */
    public static boolean load(String name, boolean upload) {
        if (!installed() || name == null || name.isEmpty()) return false;
        Path p = avatarsDir().resolve(name).normalize();
        if (!p.startsWith(avatarsDir()) || !Files.exists(p)) return false; // no path tricks out of the avatars folder
        return load(p, upload);
    }

    public static boolean load(Path path, boolean upload) {
        if (!installed() || path == null) return false;
        try {
            Class.forName(MANAGER).getMethod("loadLocalAvatar", Path.class).invoke(null, path);
            if (upload) pendingUpload = 20 * 15;
            return true;
        } catch (Throwable t) {
            SkinMod.LOGGER.warn("Could not load Figura avatar {}", path, t);
            return false;
        }
    }

    /**
     * Rebuilds the player's current Figura avatar. Done after every skin change so avatars that use the skin
     * (their "skin" texture, or parts copied from it) pick up the new one without a manual reload.
     */
    public static void reloadCurrent() {
        if (!installed()) return;
        // after the tasks already queued, so the new skin texture is registered before Figura looks at it
        Minecraft.getInstance().execute(() -> {
            Path last = current();
            if (last != null && Files.exists(last)) {
                load(last, true); // a local avatar: rebuild it and upload it again
                return;
            }
            try {
                Minecraft mc = Minecraft.getInstance();
                if (mc.player != null) Class.forName(MANAGER).getMethod("reloadAvatar", UUID.class).invoke(null, mc.player.getUUID());
            } catch (Throwable t) {
                SkinMod.LOGGER.debug("Could not reload the Figura avatar", t);
            }
        });
    }

    /** Called every client tick: uploads a freshly loaded avatar once Figura has finished building it. */
    public static void tick() {
        if (pendingUpload < 0) return;
        if (--pendingUpload < 0) return;
        if (pendingUpload % 5 != 0) return;
        try {
            Minecraft mc = Minecraft.getInstance();
            if (mc.player == null) { pendingUpload = -1; return; }
            Class<?> mgr = Class.forName(MANAGER);
            Object avatar = mgr.getMethod("getAvatarForPlayer", UUID.class).invoke(null, mc.player.getUUID());
            if (avatar == null) return;
            Field nbt = avatar.getClass().getField("nbt");
            if (nbt.get(avatar) == null) return; // still loading
            Class<?> net = Class.forName(NETWORK);
            Method up = null;
            for (Method m : net.getMethods()) if (m.getName().equals("uploadAvatar") && m.getParameterCount() == 1) up = m;
            if (up == null) { pendingUpload = -1; return; }
            up.invoke(null, avatar); // Figura picks the backend / server itself and ignores it when offline
            mgr.getField("localUploaded").setBoolean(null, true);
            pendingUpload = -1;
        } catch (Throwable t) {
            pendingUpload = -1; // give up quietly; the avatar is still active locally
        }
    }
}
