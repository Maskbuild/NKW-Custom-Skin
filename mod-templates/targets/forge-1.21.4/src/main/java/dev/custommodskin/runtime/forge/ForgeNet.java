package dev.custommodskin.runtime.forge;

import dev.custommodskin.runtime.SkinMod;
import dev.custommodskin.runtime.net.Msg;
import dev.custommodskin.runtime.net.Net;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.server.level.ServerPlayer;
import net.minecraftforge.network.ChannelBuilder;
import net.minecraftforge.network.NetworkDirection;
import net.minecraftforge.network.PacketDistributor;
import net.minecraftforge.network.SimpleChannel;

import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Function;

/** One SimpleChannel carries every mod packet; the channel is optional so vanilla clients and servers still connect. */
final class ForgeNet implements Net {
    private final SimpleChannel channel = ChannelBuilder.named(SkinMod.id("main")).networkProtocolVersion(1).optional().simpleChannel();
    private int next = 0;

    @Override
    public <M extends Msg> void c2s(String name, Class<M> cls, Function<FriendlyByteBuf, M> decoder, BiConsumer<M, ServerPlayer> handler) {
        channel.messageBuilder(cls, next++, NetworkDirection.PLAY_TO_SERVER)
                .encoder((m, buf) -> m.write(buf))
                .decoder(buf -> decoder.apply(buf))
                .consumerMainThread((m, ctx) -> {
                    ServerPlayer sender = ctx.getSender();
                    if (sender != null) handler.accept(m, sender);
                })
                .add();
    }

    @Override
    public <M extends Msg> void s2c(String name, Class<M> cls, Function<FriendlyByteBuf, M> decoder, Consumer<M> handler) {
        channel.messageBuilder(cls, next++, NetworkDirection.PLAY_TO_CLIENT)
                .encoder((m, buf) -> m.write(buf))
                .decoder(buf -> decoder.apply(buf))
                .consumerMainThread((m, ctx) -> handler.accept(m))
                .add();
    }

    /** After every message is registered. */
    void build() {
        channel.build();
    }

    @Override
    public void toServer(Msg msg) {
        channel.send(msg, PacketDistributor.SERVER.noArg());
    }

    @Override
    public void toPlayer(ServerPlayer player, Msg msg) {
        channel.send(msg, PacketDistributor.PLAYER.with(player));
    }

    @Override
    public boolean canSendToServer(Class<? extends Msg> cls) {
        return ForgeClientEvents.serverHasChannel(channel);
    }

    @Override
    public boolean canSendToPlayer(ServerPlayer player, Class<? extends Msg> cls) {
        return channel.isRemotePresent(player.connection.getConnection());
    }
}
