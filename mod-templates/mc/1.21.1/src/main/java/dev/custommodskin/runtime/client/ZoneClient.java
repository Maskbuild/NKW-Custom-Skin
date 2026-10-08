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
import net.minecraft.core.particles.BlockParticleOption;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

/** Client side of skin zones: hotbar hint / auto-open, marker icons, and the outline shown to creative builders. */
public final class ZoneClient {
    private static boolean inside;
    /** the window was opened or dismissed for this visit; do not reopen until the player leaves */
    private static boolean handled;
    private static int markerTick;

    private ZoneClient() {}

    public static void setInside(boolean now) {
        inside = now;
        if (!now) handled = false;
    }

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

    /** Marker icons at every zone block while the item is held (they have no model of their own). */
    private static void markers(Minecraft mc) {
        if (mc.level == null || !holdingZoneItem(mc)) { markerTick = 0; return; }
        if (markerTick++ % 60 != 0) return; // the particle lives 80 ticks
        for (ZoneBlockEntity z : ZoneBlockEntity.loaded(true)) {
            if (z.isRemoved() || z.getBlockPos().distSqr(mc.player.blockPosition()) > 48 * 48) continue;
            mc.level.addParticle(new BlockParticleOption(ParticleTypes.BLOCK_MARKER, z.getBlockState()),
                    z.getBlockPos().getX() + 0.5, z.getBlockPos().getY() + 0.5, z.getBlockPos().getZ() + 0.5, 0, 0, 0);
        }
    }

    /** Every client tick (loader hook). */
    public static void tick(Minecraft mc, KeyMapping openKey) {
        markers(mc);
        if (!inside || mc.player == null || mc.level == null) return;
        if ("instant".equals(SkinConfig.zoneMode())) {
            if (!handled && mc.screen == null) {
                handled = true;
                mc.setScreen(new SkinScreen());
            }
        } else if (mc.screen == null) {
            String key = openKey != null ? openKey.getTranslatedKeyMessage().getString() : "K";
            mc.gui.setOverlayMessage(Component.literal(SkinConfig.zoneMessage().replace("{{button}}", key)), false);
        }
    }

    /** Draws the zone boxes while the item is held; the loader calls this from its world-render event. */
    public static void renderOutline(PoseStack pose, MultiBufferSource buffers, Vec3 cam) {
        Minecraft mc = Minecraft.getInstance();
        if (!SkinConfig.zoneEnabled() || !holdingZoneItem(mc)) return;
        VertexConsumer vc = buffers.getBuffer(RenderType.lines());
        for (ZoneBlockEntity z : ZoneBlockEntity.loaded(true)) {
            if (z.isRemoved() || z.getBlockPos().distToCenterSqr(cam) > 96 * 96) continue;
            AABB b = z.box().move(-cam.x, -cam.y, -cam.z);
            LevelRenderer.renderLineBox(pose, vc, b, 0.25f, 1.0f, 0.45f, 1.0f);
        }
    }
}
