package dev.custommodskin.runtime.server;

import dev.custommodskin.runtime.SkinConfig;
import dev.custommodskin.runtime.SkinMod;
import dev.custommodskin.runtime.block.ZoneBlockEntity;
import dev.custommodskin.runtime.net.Messages;
import net.minecraft.core.BlockPos;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Tells each client whether its player stands inside a skin zone, and applies zone edits from creative players. */
public final class ZoneTracker {
    private static final Map<UUID, Boolean> inside = new ConcurrentHashMap<>();
    private static int tick;

    private ZoneTracker() {}

    /** Loader hook: every server tick. */
    public static void onServerTick(MinecraftServer server) {
        if (!SkinConfig.zoneEnabled()) return;
        if (++tick % 4 != 0) return; // 5 checks per second is plenty
        Set<ZoneBlockEntity> zones = ZoneBlockEntity.loaded(false);
        for (ServerPlayer p : server.getPlayerList().getPlayers()) {
            boolean now = false;
            for (ZoneBlockEntity z : zones) {
                if (z.getLevel() == p.level() && !z.isRemoved() && z.box().contains(p.position().add(0, 0.1, 0))) { now = true; break; }
            }
            Boolean was = inside.put(p.getUUID(), now);
            if (was == null ? now : was != now) {
                if (SkinMod.platform.net().canSendToPlayer(p, Messages.ZoneState.class)) SkinMod.platform.net().toPlayer(p, new Messages.ZoneState(now));
            }
        }
    }

    public static void onDisconnect(ServerPlayer player) {
        inside.remove(player.getUUID());
    }

    public static void onConfig(Messages.ZoneConfig msg, ServerPlayer p) {
        if (!SkinConfig.zoneEnabled()) return;
        BlockPos pos = msg.pos();
        if (!p.isCreative() || p.distanceToSqr(pos.getCenter()) > 64 * 64 || !p.level().hasChunkAt(pos)) return; // never load chunks for a client
        if (p.level().getBlockEntity(pos) instanceof ZoneBlockEntity z) z.setSize(msg.width(), msg.length(), msg.height());
    }
}
