package dev.custommodskin.runtime.fabric;

import dev.custommodskin.runtime.SkinMod;
import dev.custommodskin.runtime.block.SkinBlocks;
import dev.custommodskin.runtime.server.ServerSkins;
import dev.custommodskin.runtime.server.ZoneTracker;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.item.CreativeModeTabs;

public final class SkinModFabric implements ModInitializer {
    static FabricPlatform platform;

    @Override
    public void onInitialize() {
        platform = new FabricPlatform();
        SkinMod.init(platform);
        SkinBlocks.create();

        if (SkinBlocks.STATION != null) {
            Registry.register(BuiltInRegistries.BLOCK, SkinBlocks.STATION_ID, SkinBlocks.STATION);
            Registry.register(BuiltInRegistries.ITEM, SkinBlocks.STATION_ID, SkinBlocks.STATION_ITEM);
            ItemGroupEvents.modifyEntriesEvent(CreativeModeTabs.FUNCTIONAL_BLOCKS).register(e -> e.accept(SkinBlocks.STATION_ITEM));
        }
        if (SkinBlocks.ZONE != null) {
            Registry.register(BuiltInRegistries.BLOCK, SkinBlocks.ZONE_ID, SkinBlocks.ZONE);
            Registry.register(BuiltInRegistries.ITEM, SkinBlocks.ZONE_ID, SkinBlocks.ZONE_ITEM);
            Registry.register(BuiltInRegistries.BLOCK_ENTITY_TYPE, SkinBlocks.ZONE_ID, SkinBlocks.ZONE_BE);
            ItemGroupEvents.modifyEntriesEvent(CreativeModeTabs.OP_BLOCKS).register(e -> e.accept(SkinBlocks.ZONE_ITEM));
        }

        ServerLifecycleEvents.SERVER_STARTED.register(ServerSkins::onServerStarted);
        ServerLifecycleEvents.SERVER_STOPPING.register(s -> ServerSkins.onServerStopping());
        ServerTickEvents.END_SERVER_TICK.register(ZoneTracker::onServerTick);
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> ServerSkins.onJoin(handler.getPlayer()));
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            ServerSkins.onDisconnect(handler.getPlayer());
            ZoneTracker.onDisconnect(handler.getPlayer());
        });
    }
}
