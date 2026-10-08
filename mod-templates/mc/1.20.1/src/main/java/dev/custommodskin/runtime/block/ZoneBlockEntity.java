package dev.custommodskin.runtime.block;

import dev.custommodskin.runtime.SkinConfig;
import net.minecraft.core.BlockPos;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.protocol.Packet;
import net.minecraft.network.protocol.game.ClientGamePacketListener;
import net.minecraft.network.protocol.game.ClientboundBlockEntityDataPacket;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** A skin zone: an invisible box centred on the block (x/z) and rising from it (y). */
public class ZoneBlockEntity extends BlockEntity {
    /** Zone blocks the client knows about; weakly consistent iteration is safe, so nobody copies it. */
    private static final Set<ZoneBlockEntity> LOADED = ConcurrentHashMap.newKeySet();

    private int width = SkinConfig.zoneDefault("width");
    private int length = SkinConfig.zoneDefault("length");
    private int height = SkinConfig.zoneDefault("height");

    public ZoneBlockEntity(BlockPos pos, BlockState state) {
        super(SkinBlocks.ZONE_BE, pos, state);
    }

    public static Set<ZoneBlockEntity> loaded() {
        return LOADED;
    }

    public static void clearLoaded() {
        LOADED.clear();
    }

    public int width() { return width; }
    public int length() { return length; }
    public int height() { return height; }

    public void setSize(int w, int l, int h) {
        width = clamp(w);
        length = clamp(l);
        height = clamp(h);
        box = null;
        setChanged();
        if (level != null) level.sendBlockUpdated(worldPosition, getBlockState(), getBlockState(), 3);
    }

    private static int clamp(int v) {
        return Math.max(1, Math.min(SkinConfig.MAX_ZONE, v));
    }

    private AABB box;

    /** The zone area; built once and rebuilt only when the size changes. */
    public AABB box() {
        AABB b = box;
        if (b == null) {
            double cx = worldPosition.getX() + 0.5, cz = worldPosition.getZ() + 0.5;
            box = b = new AABB(cx - width / 2.0, worldPosition.getY(), cz - length / 2.0, cx + width / 2.0, worldPosition.getY() + height, cz + length / 2.0);
        }
        return b;
    }

    @Override
    public void setRemoved() {
        super.setRemoved();
        LOADED.remove(this);
    }

    @Override
    public void setLevel(Level level) {
        super.setLevel(level);
        if (level.isClientSide) LOADED.add(this);
    }

    @Override
    protected void saveAdditional(CompoundTag tag) {
        super.saveAdditional(tag);
        tag.putInt("w", width);
        tag.putInt("l", length);
        tag.putInt("h", height);
    }

    @Override
    public void load(CompoundTag tag) {
        super.load(tag);
        if (tag.contains("w")) width = clamp(tag.getInt("w"));
        if (tag.contains("l")) length = clamp(tag.getInt("l"));
        if (tag.contains("h")) height = clamp(tag.getInt("h"));
        box = null;
    }

    @Override
    public Packet<ClientGamePacketListener> getUpdatePacket() {
        return ClientboundBlockEntityDataPacket.create(this);
    }

    @Override
    public CompoundTag getUpdateTag() {
        return saveWithoutMetadata();
    }
}
