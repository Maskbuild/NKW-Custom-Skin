package dev.custommodskin.runtime.fabric;

import dev.custommodskin.runtime.SkinMod;
import dev.custommodskin.runtime.net.Msg;
import dev.custommodskin.runtime.net.Net;
import net.fabricmc.fabric.api.networking.v1.PacketByteBufs;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Function;

/** Every mod packet is a plain Fabric channel; the buffer is decoded on the network thread and handled on the main thread. */
final class FabricNet implements Net {
    private final Map<Class<?>, ResourceLocation> ids = new HashMap<>();
    /** client receivers are attached by the client entrypoint, so the server never touches client classes */
    final List<Runnable> clientReceivers = new ArrayList<>();

    @Override
    public <M extends Msg> void c2s(String name, Class<M> cls, Function<FriendlyByteBuf, M> decoder, BiConsumer<M, ServerPlayer> handler) {
        ResourceLocation id = SkinMod.id(name);
        ids.put(cls, id);
        ServerPlayNetworking.registerGlobalReceiver(id, (server, player, listener, buf, responder) -> {
            M msg = decoder.apply(buf);
            server.execute(() -> handler.accept(msg, player));
        });
    }

    @Override
    public <M extends Msg> void s2c(String name, Class<M> cls, Function<FriendlyByteBuf, M> decoder, Consumer<M> handler) {
        ResourceLocation id = SkinMod.id(name);
        ids.put(cls, id);
        clientReceivers.add(() -> FabricClientNet.receive(id, buf -> {
            M msg = decoder.apply(buf);
            return () -> handler.accept(msg);
        }));
    }

    private static FriendlyByteBuf encode(Msg msg) {
        FriendlyByteBuf buf = PacketByteBufs.create();
        msg.write(buf);
        return buf;
    }

    @Override
    public void toServer(Msg msg) {
        FabricClientNet.send(ids.get(msg.getClass()), encode(msg));
    }

    @Override
    public void toPlayer(ServerPlayer player, Msg msg) {
        ServerPlayNetworking.send(player, ids.get(msg.getClass()), encode(msg));
    }

    @Override
    public boolean canSendToServer(Class<? extends Msg> cls) {
        return FabricClientNet.canSend(ids.get(cls));
    }

    @Override
    public boolean canSendToPlayer(ServerPlayer player, Class<? extends Msg> cls) {
        return ServerPlayNetworking.canSend(player, ids.get(cls));
    }
}
