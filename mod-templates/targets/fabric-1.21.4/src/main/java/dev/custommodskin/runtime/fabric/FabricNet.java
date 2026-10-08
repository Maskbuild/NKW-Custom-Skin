package dev.custommodskin.runtime.fabric;

import dev.custommodskin.runtime.SkinMod;
import dev.custommodskin.runtime.net.Msg;
import dev.custommodskin.runtime.net.Net;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.server.level.ServerPlayer;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Function;

/** Every mod packet travels inside one wrapper payload type per message. */
final class FabricNet implements Net {
    record Wrapper(CustomPacketPayload.Type<Wrapper> type, Msg msg) implements CustomPacketPayload {
        @Override public Type<Wrapper> type() { return type; }
    }

    private final Map<Class<?>, CustomPacketPayload.Type<Wrapper>> types = new HashMap<>();
    /** client receivers are attached by the client entrypoint, so the server never touches client classes */
    final List<Runnable> clientReceivers = new ArrayList<>();

    @Override
    public <M extends Msg> void c2s(String name, Class<M> cls, Function<FriendlyByteBuf, M> decoder, BiConsumer<M, ServerPlayer> handler) {
        var type = new CustomPacketPayload.Type<Wrapper>(SkinMod.id(name));
        types.put(cls, type);
        PayloadTypeRegistry.playC2S().register(type, StreamCodec.of((buf, w) -> w.msg().write(buf), buf -> new Wrapper(type, decoder.apply(buf))));
        ServerPlayNetworking.registerGlobalReceiver(type, (payload, ctx) ->
                ctx.server().execute(() -> handler.accept(cls.cast(payload.msg()), ctx.player())));
    }

    @Override
    public <M extends Msg> void s2c(String name, Class<M> cls, Function<FriendlyByteBuf, M> decoder, Consumer<M> handler) {
        var type = new CustomPacketPayload.Type<Wrapper>(SkinMod.id(name));
        types.put(cls, type);
        PayloadTypeRegistry.playS2C().register(type, StreamCodec.of((buf, w) -> w.msg().write(buf), buf -> new Wrapper(type, decoder.apply(buf))));
        clientReceivers.add(() -> FabricClientNet.receive(type, p -> handler.accept(cls.cast(p.msg()))));
    }

    @Override
    public void toServer(Msg msg) {
        FabricClientNet.send(new Wrapper(types.get(msg.getClass()), msg));
    }

    @Override
    public void toPlayer(ServerPlayer player, Msg msg) {
        ServerPlayNetworking.send(player, new Wrapper(types.get(msg.getClass()), msg));
    }

    @Override
    public boolean canSendToServer(Class<? extends Msg> cls) {
        return FabricClientNet.canSend(types.get(cls));
    }

    @Override
    public boolean canSendToPlayer(ServerPlayer player, Class<? extends Msg> cls) {
        return ServerPlayNetworking.canSend(player, types.get(cls));
    }
}
