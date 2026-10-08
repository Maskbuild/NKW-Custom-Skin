package dev.custommodskin.runtime.client;

import com.mojang.blaze3d.platform.InputConstants;
import dev.custommodskin.runtime.SkinConfig;
import dev.custommodskin.runtime.block.SkinBlocks;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import org.lwjgl.glfw.GLFW;

/** Client-side setup shared by every loader. The loader registers {@link #OPEN_KEY} and calls the hooks below. */
public final class ClientInit {
    /** null when the mod has neither the key nor skin zones */
    public static KeyMapping OPEN_KEY;

    private ClientInit() {}

    /** Call once on the client, before key mappings are registered. */
    public static void init() {
        SkinBlocks.openWardrobe = () -> Minecraft.getInstance().setScreen(new SkinScreen());
        SkinBlocks.openZoneEditor = be -> Minecraft.getInstance().setScreen(new ZoneScreen(be));
        // The key opens the wardrobe everywhere, unless the mod has skin zones: then it only works inside one
        // (and it must exist anyway, so the zone hint can name it).
        if (SkinConfig.keyEnabled() || SkinConfig.zoneEnabled()) {
            OPEN_KEY = new KeyMapping("key.skinmod.open", InputConstants.Type.KEYSYM, glfwKey(SkinConfig.defaultKey()), "key.categories.skinmod");
        }
        if (SkinConfig.plasmoEnabled()) PlasmoBridge.init();
    }

    /** Loader hook: every client tick. */
    public static void tick(Minecraft mc) {
        if (OPEN_KEY != null) {
            while (OPEN_KEY.consumeClick()) {
                boolean allowed = SkinConfig.zoneEnabled()
                        ? ZoneClient.isInside() && "hint".equals(SkinConfig.zoneMode())
                        : SkinConfig.keyEnabled();
                if (allowed && mc.screen == null) mc.setScreen(new SkinScreen());
            }
        }
        ZoneClient.tick(mc, OPEN_KEY);
        if (SkinConfig.plasmoEnabled()) PlasmoBridge.tick();
        if (SkinConfig.figuraEnabled()) FiguraBridge.tick();
    }

    /** Loader hook: joined a world or server (re-sends the worn outfit). */
    public static void onJoin(Minecraft mc) {
        mc.execute(Wardrobe::applySelected);
    }

    /** Loader hook: left a world or server. */
    public static void onDisconnect() {
        ClientSkins.reset();
        ZoneClient.reset();
    }

    /** "K" -> GLFW_KEY_K, "F7" -> GLFW_KEY_F7; unknown names fall back to K. */
    private static int glfwKey(String name) {
        String n = name.trim().toUpperCase();
        try {
            if (n.length() == 1 && Character.isLetterOrDigit(n.charAt(0))) return n.charAt(0);
            return GLFW.class.getField("GLFW_KEY_" + n).getInt(null);
        } catch (ReflectiveOperationException e) {
            return GLFW.GLFW_KEY_K;
        }
    }
}
