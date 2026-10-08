package dev.custommodskin.runtime.server;

import dev.custommodskin.runtime.SkinConfig;
import dev.custommodskin.runtime.block.ZoneBlockEntity;
import dev.custommodskin.runtime.net.Messages;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerPlayer;

/** Applies zone edits from creative players. (Whether a player is inside a zone is worked out on the client.) */
public final class ZoneTracker {
    private ZoneTracker() {}

    public static void onConfig(Messages.ZoneConfig msg, ServerPlayer p) {
        if (!SkinConfig.zoneEnabled()) return;
        BlockPos pos = msg.pos();
        if (!p.isCreative() || p.distanceToSqr(pos.getCenter()) > 64 * 64 || !p.level().hasChunkAt(pos)) return; // never load chunks for a client
        if (p.level().getBlockEntity(pos) instanceof ZoneBlockEntity z) z.setSize(msg.width(), msg.length(), msg.height());
    }
}
