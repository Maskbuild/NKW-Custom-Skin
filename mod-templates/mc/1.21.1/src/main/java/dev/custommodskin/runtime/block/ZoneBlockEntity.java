package dev.custommodskin.runtime.block;

import dev.custommodskin.runtime.SkinConfig;
import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.protocol.Packet;
import net.minecraft.network.protocol.game.ClientGamePacketListener;
import net.minecraft.network.protocol.game.ClientboundBlockEntityDataPacket;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/** A skin zone: an invisible box centred on the block (x/z) and rising from it (y). */
public class ZoneBlockEntity extends BlockEntity {
    private static final Set<ZoneBlockEntity> SERVER = Collections.synchronizedSet(new HashSet<>());
    private static final Set<ZoneBlockEntity> CLIENT = Collections.synchronizedSet(new HashSet<>());

    private int width = SkinConfig.zoneDefault("width");
    private int length = SkinConfig.zoneDefault("length");
    private int height = SkinConfig.zoneDefault("height");

    public ZoneBlockEntity(BlockPos pos, BlockState state) {
        super(SkinBlocks.ZONE_BE, pos, state);
    }

    /** Loaded zones of one side (server or client), as a copy that is safe to iterate. */
    public static Set<ZoneBlockEntity> loaded(boolean client) {
        Set<ZoneBlockEntity> src = client ? CLIENT : SERVER;
        synchronized (src) {
            return new HashSet<>(src);
        }
    }

    public int width() { return width; }
    public int length() { return length; }
    public int height() { return height; }

    public void setSize(int w, int l, int h) {
        width = clamp(w);
        length = clamp(l);
        height = clamp(h);
        setChanged();
        if (level != null) level.sendBlockUpdated(worldPosition, getBlockState(), getBlockState(), 3);
    }

    private static int clamp(int v) {
        return Math.max(1, Math.min(SkinConfig.MAX_ZONE, v));
    }

    public AABB box() {
        double cx = worldPosition.getX() + 0.5, cz = worldPosition.getZ() + 0.5;
        return new AABB(cx - width / 2.0, worldPosition.getY(), cz - length / 2.0, cx + width / 2.0, worldPosition.getY() + height, cz + length / 2.0);
    }

    @Override
    public void setRemoved() {
        super.setRemoved();
        SERVER.remove(this);
        CLIENT.remove(this);
    }

    @Override
    public void setLevel(Level level) {
        super.setLevel(level);
        (level.isClientSide ? CLIENT : SERVER).add(this);
    }

    @Override
    protected void saveAdditional(CompoundTag tag, HolderLookup.Provider lookup) {
        super.saveAdditional(tag, lookup);
        tag.putInt("w", width);
        tag.putInt("l", length);
        tag.putInt("h", height);
    }

    @Override
    protected void loadAdditional(CompoundTag tag, HolderLookup.Provider lookup) {
        super.loadAdditional(tag, lookup);
        if (tag.contains("w")) width = clamp(tag.getInt("w"));
        if (tag.contains("l")) length = clamp(tag.getInt("l"));
        if (tag.contains("h")) height = clamp(tag.getInt("h"));
    }

    @Override
    public Packet<ClientGamePacketListener> getUpdatePacket() {
        return ClientboundBlockEntityDataPacket.create(this);
    }

    @Override
    public CompoundTag getUpdateTag(HolderLookup.Provider lookup) {
        return saveWithoutMetadata(lookup);
    }
}
