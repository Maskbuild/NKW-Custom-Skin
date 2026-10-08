package dev.custommodskin.runtime.fabric;

import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;

import java.util.function.Consumer;

/** The only place that names Fabric client networking, so server-side code never loads it. */
final class FabricClientNet {
    private FabricClientNet() {}

    static void send(FabricNet.Wrapper w) {
        ClientPlayNetworking.send(w);
    }

    static boolean canSend(CustomPacketPayload.Type<FabricNet.Wrapper> type) {
        return ClientPlayNetworking.canSend(type);
    }

    static void receive(CustomPacketPayload.Type<FabricNet.Wrapper> type, Consumer<FabricNet.Wrapper> handler) {
        ClientPlayNetworking.registerGlobalReceiver(type, (payload, ctx) -> handler.accept(payload));
    }
}
