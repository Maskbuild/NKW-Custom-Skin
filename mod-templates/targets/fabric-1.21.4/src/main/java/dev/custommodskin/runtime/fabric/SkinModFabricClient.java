package dev.custommodskin.runtime.fabric;

import dev.custommodskin.runtime.client.ClientInit;
import dev.custommodskin.runtime.client.ZoneClient;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderEvents;

public final class SkinModFabricClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        for (Runnable r : SkinModFabric.platform.fabricNet().clientReceivers) r.run();

        ClientInit.init();
        if (ClientInit.OPEN_KEY != null) KeyBindingHelper.registerKeyBinding(ClientInit.OPEN_KEY);

        ClientTickEvents.END_CLIENT_TICK.register(ClientInit::tick);
        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> ClientInit.onJoin(client));
        ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> ClientInit.onDisconnect());
        ZoneClient.outlineDrawnByLoader = true;
        WorldRenderEvents.AFTER_TRANSLUCENT.register(ctx ->
                ZoneClient.renderOutline(ctx.matrixStack(), ctx.consumers(), ctx.camera().getPosition()));
    }
}
