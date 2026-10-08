package dev.custommodskin.runtime.forge;

import dev.custommodskin.runtime.SkinMod;
import dev.custommodskin.runtime.block.SkinBlocks;
import net.minecraft.core.registries.Registries;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.BuildCreativeModeTabContentsEvent;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import net.minecraftforge.fml.loading.FMLEnvironment;
import net.minecraftforge.registries.RegisterEvent;

/** The token below is replaced with the mod id chosen in the launcher. */
@Mod("@@MOD_ID@@")
public final class SkinModForge {
    static ForgePlatform platform;

    public SkinModForge(FMLJavaModLoadingContext context) {
        platform = new ForgePlatform();
        SkinMod.init(platform);
        platform.forgeNet().build();

        IEventBus mod = context.getModEventBus();
        mod.addListener(SkinModForge::onRegister);
        mod.addListener(SkinModForge::onCreativeTab);
        MinecraftForge.EVENT_BUS.register(ForgeEvents.class);
        if (FMLEnvironment.dist == Dist.CLIENT) ForgeClientEvents.init(mod);
    }

    private static void onRegister(RegisterEvent event) {
        event.register(Registries.BLOCK, helper -> {
            SkinBlocks.create(); // objects must be made while registries are still open
            if (SkinBlocks.STATION != null) helper.register(SkinBlocks.STATION_ID, SkinBlocks.STATION);
            if (SkinBlocks.ZONE != null) helper.register(SkinBlocks.ZONE_ID, SkinBlocks.ZONE);
        });
        event.register(Registries.ITEM, helper -> {
            SkinBlocks.create();
            if (SkinBlocks.STATION_ITEM != null) helper.register(SkinBlocks.STATION_ID, SkinBlocks.STATION_ITEM);
            if (SkinBlocks.ZONE_ITEM != null) helper.register(SkinBlocks.ZONE_ID, SkinBlocks.ZONE_ITEM);
        });
        event.register(Registries.BLOCK_ENTITY_TYPE, helper -> {
            SkinBlocks.create();
            if (SkinBlocks.ZONE_BE != null) helper.register(SkinBlocks.ZONE_ID, SkinBlocks.ZONE_BE);
        });
    }

    private static void onCreativeTab(BuildCreativeModeTabContentsEvent event) {
        if (event.getTabKey() == CreativeModeTabs.FUNCTIONAL_BLOCKS && SkinBlocks.STATION_ITEM != null) event.accept(SkinBlocks.STATION_ITEM);
        if (event.getTabKey() == CreativeModeTabs.OP_BLOCKS && SkinBlocks.ZONE_ITEM != null) event.accept(SkinBlocks.ZONE_ITEM);
    }
}
