package dev.custommodskin.runtime.forge;

import dev.custommodskin.runtime.server.ServerSkins;
import dev.custommodskin.runtime.server.ZoneTracker;
import net.minecraft.server.level.ServerPlayer;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.event.entity.player.PlayerEvent;
import net.minecraftforge.event.server.ServerStartedEvent;
import net.minecraftforge.event.server.ServerStoppingEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;

/** Game events that both the client and a dedicated server see. */
public final class ForgeEvents {
    private ForgeEvents() {}

    @SubscribeEvent
    public static void onServerStarted(ServerStartedEvent event) {
        ServerSkins.onServerStarted(event.getServer());
    }

    @SubscribeEvent
    public static void onServerStopping(ServerStoppingEvent event) {
        ServerSkins.onServerStopping();
    }

    @SubscribeEvent
    public static void onServerTick(TickEvent.ServerTickEvent event) {
        if (event.phase == TickEvent.Phase.END) ZoneTracker.onServerTick(event.getServer());
    }

    @SubscribeEvent
    public static void onLogin(PlayerEvent.PlayerLoggedInEvent event) {
        if (event.getEntity() instanceof ServerPlayer p) ServerSkins.onJoin(p);
    }

    @SubscribeEvent
    public static void onLogout(PlayerEvent.PlayerLoggedOutEvent event) {
        if (event.getEntity() instanceof ServerPlayer p) {
            ServerSkins.onDisconnect(p);
            ZoneTracker.onDisconnect(p);
        }
    }
}
