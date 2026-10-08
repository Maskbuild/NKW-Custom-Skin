package dev.custommodskin.runtime.forge;

import dev.custommodskin.runtime.SkinMod;
import dev.custommodskin.runtime.net.Msg;
import dev.custommodskin.runtime.net.Net;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.server.level.ServerPlayer;
import net.minecraftforge.network.NetworkEvent;
import net.minecraftforge.network.NetworkRegistry;
import net.minecraftforge.network.PacketDistributor;
import net.minecraftforge.network.simple.SimpleChannel;

import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Function;

/** One SimpleChannel carries every mod packet; the channel is optional so vanilla clients and servers still connect. */
final class ForgeNet implements Net {
    private static final String PROTOCOL = "1";

    private final SimpleChannel channel = NetworkRegistry.newSimpleChannel(
            SkinMod.id("main"), () -> PROTOCOL, NetworkRegistry.acceptMissingOr(PROTOCOL), NetworkRegistry.acceptMissingOr(PROTOCOL));
    private int next = 0;

    @Override
    public <M extends Msg> void c2s(String name, Class<M> cls, Function<FriendlyByteBuf, M> decoder, BiConsumer<M, ServerPlayer> handler) {
        channel.registerMessage(next++, cls, (m, buf) -> m.write(buf), decoder, (m, ctxSupplier) -> {
            NetworkEvent.Context ctx = ctxSupplier.get();
            ServerPlayer sender = ctx.getSender();
            ctx.enqueueWork(() -> { if (sender != null) handler.accept(m, sender); });
            ctx.setPacketHandled(true);
        });
    }

    @Override
    public <M extends Msg> void s2c(String name, Class<M> cls, Function<FriendlyByteBuf, M> decoder, Consumer<M> handler) {
        channel.registerMessage(next++, cls, (m, buf) -> m.write(buf), decoder, (m, ctxSupplier) -> {
            NetworkEvent.Context ctx = ctxSupplier.get();
            ctx.enqueueWork(() -> handler.accept(m));
            ctx.setPacketHandled(true);
        });
    }

    @Override
    public void toServer(Msg msg) {
        channel.sendToServer(msg);
    }

    @Override
    public void toPlayer(ServerPlayer player, Msg msg) {
        channel.send(PacketDistributor.PLAYER.with(() -> player), msg);
    }

    @Override
    public boolean canSendToServer(Class<? extends Msg> cls) {
        return ForgeClientEvents.serverHasChannel(channel);
    }

    @Override
    public boolean canSendToPlayer(ServerPlayer player, Class<? extends Msg> cls) {
        return channel.isRemotePresent(player.connection.connection);
    }
}
