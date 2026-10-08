package dev.custommodskin.runtime.client;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import dev.custommodskin.runtime.SkinConfig;
import dev.custommodskin.runtime.block.SkinBlocks;
import dev.custommodskin.runtime.block.ZoneBlockEntity;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.LevelRenderer;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.debug.DebugRenderer;
import net.minecraft.network.chat.Component;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

import java.util.Set;

/** Client side of skin zones: the player is inside / not, the hint, the instant window, and the builder's view of the zones. */
public final class ZoneClient {
    private static boolean inside;
    /** the window was opened or dismissed for this visit; do not reopen until the player leaves */
    private static boolean handled;

    private ZoneClient() {}

    public static boolean isInside() { return inside; }

    /** The window was closed (by the player) while inside a zone. */
    public static void windowClosed() { if (inside) handled = true; }

    public static void reset() {
        inside = false;
        handled = false;
    }

    private static boolean holdingZoneItem(Minecraft mc) {
        return mc.player != null && SkinBlocks.ZONE_ITEM != null
                && (mc.player.getMainHandItem().is(SkinBlocks.ZONE_ITEM) || mc.player.getOffhandItem().is(SkinBlocks.ZONE_ITEM));
    }

    /** Worked out here from the zone blocks the client has loaded, so the hint comes and goes at once. */
    private static void updateInside(Minecraft mc) {
        boolean now = false;
        Set<ZoneBlockEntity> zones = ZoneBlockEntity.loaded();
        if (!zones.isEmpty()) {
            Vec3 p = mc.player.position().add(0, 0.1, 0);
            for (ZoneBlockEntity z : zones) {
                if (!z.isRemoved() && z.getLevel() == mc.level && z.box().contains(p)) { now = true; break; }
            }
        }
        if (now != inside) {
            inside = now;
            if (!now) handled = false;
        }
    }

    /** Every client tick (loader hook). */
    public static void tick(Minecraft mc) {
        if (!SkinConfig.zoneEnabled() || mc.player == null || mc.level == null) {
            reset();
            return;
        }
        updateInside(mc);
        if (inside && !handled && "instant".equals(SkinConfig.zoneMode()) && mc.screen == null) {
            handled = true;
            mc.setScreen(new SkinScreen());
        }
    }

    /** The hotbar message for the zone the player is in, or null. */
    static Component hint(KeyMapping openKey) {
        if (!inside || !"hint".equals(SkinConfig.zoneMode())) return null;
        String key = openKey != null ? openKey.getTranslatedKeyMessage().getString() : "K";
        return Component.literal(SkinConfig.zoneMessage().replace("{{button}}", key));
    }

    /**
     * Draws the zones while the item is held: the block itself as a green cube, and the whole area as an outline.
     * The loader calls this from its world-render event.
     */
    public static void renderOutline(PoseStack pose, MultiBufferSource buffers, Vec3 cam) {
        Minecraft mc = Minecraft.getInstance();
        if (!SkinConfig.zoneEnabled() || !holdingZoneItem(mc)) return;
        VertexConsumer lines = buffers.getBuffer(RenderType.lines());
        for (ZoneBlockEntity z : ZoneBlockEntity.loaded()) {
            if (z.isRemoved() || z.getBlockPos().distToCenterSqr(cam) > 96 * 96) continue;
            DebugRenderer.renderFilledBox(pose, buffers, new AABB(z.getBlockPos()).inflate(0.002).move(-cam.x, -cam.y, -cam.z), 0.25f, 1.0f, 0.45f, 0.55f);
            LevelRenderer.renderLineBox(pose, lines, z.box().move(-cam.x, -cam.y, -cam.z), 0.25f, 1.0f, 0.45f, 1.0f);
        }
    }
}
