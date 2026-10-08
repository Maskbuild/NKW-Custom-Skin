package dev.custommodskin.runtime.fabric;

import dev.custommodskin.runtime.SkinMod;
import dev.custommodskin.runtime.block.SkinBlocks;
import dev.custommodskin.runtime.server.ServerSkins;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
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
        for (SkinBlocks.Custom c : SkinBlocks.CUSTOM) {
            Registry.register(BuiltInRegistries.BLOCK, c.id(), c.block());
            Registry.register(BuiltInRegistries.ITEM, c.id(), c.item());
        }
        if (!SkinBlocks.CUSTOM.isEmpty()) {
            ItemGroupEvents.modifyEntriesEvent(CreativeModeTabs.FUNCTIONAL_BLOCKS).register(e -> SkinBlocks.CUSTOM.forEach(c -> e.accept(c.item())));
        }
        UseBlockCallback.EVENT.register((player, level, hand, hit) ->
                hand == InteractionHand.MAIN_HAND && SkinBlocks.handleUse(level, player, hit.getBlockPos()) ? InteractionResult.SUCCESS : InteractionResult.PASS);
        if (SkinBlocks.ZONE != null) {
            Registry.register(BuiltInRegistries.BLOCK, SkinBlocks.ZONE_ID, SkinBlocks.ZONE);
            Registry.register(BuiltInRegistries.ITEM, SkinBlocks.ZONE_ID, SkinBlocks.ZONE_ITEM);
            Registry.register(BuiltInRegistries.BLOCK_ENTITY_TYPE, SkinBlocks.ZONE_ID, SkinBlocks.ZONE_BE);
            ItemGroupEvents.modifyEntriesEvent(CreativeModeTabs.OP_BLOCKS).register(e -> e.accept(SkinBlocks.ZONE_ITEM));
        }

        ServerLifecycleEvents.SERVER_STARTED.register(ServerSkins::onServerStarted);
        ServerLifecycleEvents.SERVER_STOPPING.register(s -> ServerSkins.onServerStopping());
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> ServerSkins.onJoin(handler.getPlayer()));
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            ServerSkins.onDisconnect(handler.getPlayer());
        });
    }
}
