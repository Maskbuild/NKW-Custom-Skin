package dev.custommodskin.runtime.fabric;

import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.resources.ResourceLocation;

import java.util.function.Function;

/** The only place that names Fabric client networking, so server-side code never loads it. */
final class FabricClientNet {
    private FabricClientNet() {}

    static void send(ResourceLocation id, FriendlyByteBuf buf) {
        ClientPlayNetworking.send(id, buf);
    }

    static boolean canSend(ResourceLocation id) {
        return ClientPlayNetworking.canSend(id);
    }

    /** {@code decode} runs on the network thread and returns what to do on the main thread. */
    static void receive(ResourceLocation id, Function<FriendlyByteBuf, Runnable> decode) {
        ClientPlayNetworking.registerGlobalReceiver(id, (client, handler, buf, responder) -> client.execute(decode.apply(buf)));
    }
}
