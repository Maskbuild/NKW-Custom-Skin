package dev.custommodskin.runtime.fabric;

import dev.custommodskin.runtime.Platform;
import dev.custommodskin.runtime.net.Net;
import net.fabricmc.loader.api.FabricLoader;

import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityType;

import java.nio.file.Path;

final class FabricPlatform implements Platform {
    private final FabricNet net = new FabricNet();

    @Override public Path configDir() { return FabricLoader.getInstance().getConfigDir(); }

    @Override public Path gameDir() { return FabricLoader.getInstance().getGameDir(); }

    @Override public boolean isModLoaded(String id) { return FabricLoader.getInstance().isModLoaded(id); }

    @Override public Net net() { return net; }

    @Override
    public <T extends BlockEntity> BlockEntityType<T> blockEntityType(BlockEntityFactory<T> factory, Block block) {
        return BlockEntityType.Builder.<T>of(factory::create, block).build(null);
    }

    FabricNet fabricNet() { return net; }
}
