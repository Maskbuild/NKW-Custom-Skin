package dev.custommodskin.runtime.net;

import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.server.level.ServerPlayer;

import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Function;

/** Networking as the common code sees it. Handlers always run on the game main thread. */
public interface Net {
    <M extends Msg> void c2s(String name, Class<M> type, Function<FriendlyByteBuf, M> decoder, BiConsumer<M, ServerPlayer> handler);

    <M extends Msg> void s2c(String name, Class<M> type, Function<FriendlyByteBuf, M> decoder, Consumer<M> handler);

    void toServer(Msg msg);

    void toPlayer(ServerPlayer player, Msg msg);

    /** The server we are connected to has this mod packets. */
    boolean canSendToServer(Class<? extends Msg> type);

    /** This player client has this mod packets. */
    boolean canSendToPlayer(ServerPlayer player, Class<? extends Msg> type);
}
