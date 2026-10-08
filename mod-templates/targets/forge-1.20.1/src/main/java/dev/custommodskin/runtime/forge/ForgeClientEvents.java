package dev.custommodskin.runtime.forge;

import dev.custommodskin.runtime.client.ClientInit;
import dev.custommodskin.runtime.client.ZoneClient;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraftforge.client.event.ClientPlayerNetworkEvent;
import net.minecraftforge.client.event.RegisterKeyMappingsEvent;
import net.minecraftforge.client.event.RenderLevelStageEvent;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.network.simple.SimpleChannel;

/** Client-only events; only ever loaded on the physical client. */
public final class ForgeClientEvents {
    private ForgeClientEvents() {}

    static void init(IEventBus mod) {
        ClientInit.init();
        mod.addListener(ForgeClientEvents::onKeys);
        MinecraftForge.EVENT_BUS.register(ForgeClientEvents.class);
    }

    static boolean serverHasChannel(SimpleChannel channel) {
        var connection = Minecraft.getInstance().getConnection();
        return connection != null && channel.isRemotePresent(connection.getConnection());
    }

    private static void onKeys(RegisterKeyMappingsEvent event) {
        if (ClientInit.OPEN_KEY != null) event.register(ClientInit.OPEN_KEY);
    }

    @SubscribeEvent
    public static void onClientTick(TickEvent.ClientTickEvent event) {
        if (event.phase == TickEvent.Phase.END) ClientInit.tick(Minecraft.getInstance());
    }

    @SubscribeEvent
    public static void onLoggingIn(ClientPlayerNetworkEvent.LoggingIn event) {
        ClientInit.onJoin(Minecraft.getInstance());
    }

    @SubscribeEvent
    public static void onLoggingOut(ClientPlayerNetworkEvent.LoggingOut event) {
        ClientInit.onDisconnect();
    }

    @SubscribeEvent
    public static void onRender(RenderLevelStageEvent event) {
        if (event.getStage() != RenderLevelStageEvent.Stage.AFTER_TRANSLUCENT_BLOCKS) return;
        MultiBufferSource.BufferSource buffers = Minecraft.getInstance().renderBuffers().bufferSource();
        ZoneClient.renderOutline(event.getPoseStack(), buffers, event.getCamera().getPosition());
        buffers.endBatch(RenderType.lines());
    }
}
