package dev.custommodskin.runtime.client;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import dev.custommodskin.runtime.SkinConfig;
import dev.custommodskin.runtime.block.SkinBlocks;
import dev.custommodskin.runtime.block.ZoneBlockEntity;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.ShapeRenderer;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.core.particles.BlockParticleOption;
import net.minecraft.core.particles.DustParticleOptions;
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

    /** Set by loaders that draw the outline themselves; the others get particles along the edges. */
    public static boolean outlineDrawnByLoader = false;
    private static int edgeTick;

    /** The zone edges as green dust, for loaders without a usable world-render event. */
    private static void edgeParticles(Minecraft mc) {
        if (outlineDrawnByLoader || mc.level == null || !holdingZoneItem(mc) || !SkinConfig.zoneEnabled()) { edgeTick = 0; return; }
        if (edgeTick++ % 10 != 0) return;
        var dust = new DustParticleOptions(0x40FF73, 1.0f);
        for (ZoneBlockEntity z : ZoneBlockEntity.loaded(true)) {
            if (z.isRemoved() || z.getBlockPos().distSqr(mc.player.blockPosition()) > 48 * 48) continue;
            AABB b = z.box();
            double[] xs = {b.minX, b.maxX}, ys = {b.minY, b.maxY}, zs = {b.minZ, b.maxZ};
            for (double y : ys) for (double zz : zs) line(mc, dust, b.minX, y, zz, b.maxX, y, zz);
            for (double x : xs) for (double zz : zs) line(mc, dust, x, b.minY, zz, x, b.maxY, zz);
            for (double x : xs) for (double y : ys) line(mc, dust, x, y, b.minZ, x, y, b.maxZ);
        }
    }

    private static void line(Minecraft mc, DustParticleOptions dust, double x1, double y1, double z1, double x2, double y2, double z2) {
        double len = Math.max(Math.abs(x2 - x1), Math.max(Math.abs(y2 - y1), Math.abs(z2 - z1)));
        int n = (int) Math.min(24, Math.max(2, Math.ceil(len)));
        for (int i = 0; i <= n; i++) {
            double t = i / (double) n;
            mc.level.addParticle(dust, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, z1 + (z2 - z1) * t, 0, 0, 0);
        }
    }

    /** Every client tick (loader hook). */
    public static void tick(Minecraft mc, KeyMapping openKey) {
        markers(mc);
        edgeParticles(mc);
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
            ShapeRenderer.renderLineBox(pose, vc, b, 0.25f, 1.0f, 0.45f, 1.0f);
        }
    }
}
