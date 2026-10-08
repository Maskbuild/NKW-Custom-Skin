package dev.custommodskin.runtime;

import dev.custommodskin.runtime.net.Net;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockState;

import java.nio.file.Path;

/** What the common code needs from the mod loader. Implemented once per loader. */
public interface Platform {
    Path configDir();

    Path gameDir();

    boolean isModLoaded(String id);

    Net net();

    /** Block entity types are built differently by each loader and version. */
    <T extends BlockEntity> BlockEntityType<T> blockEntityType(BlockEntityFactory<T> factory, Block block);

    interface BlockEntityFactory<T extends BlockEntity> {
        T create(BlockPos pos, BlockState state);
    }
}
