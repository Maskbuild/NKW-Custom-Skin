package dev.custommodskin.runtime.net;

import net.minecraft.network.FriendlyByteBuf;

/** A packet of this mod. Loaders wrap it in whatever their networking layer needs. */
public interface Msg {
    void write(FriendlyByteBuf buf);
}
