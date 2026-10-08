package dev.custommodskin.runtime.mixin;

import dev.custommodskin.runtime.client.ClientSkins;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.resources.ResourceLocation;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Swaps in the HD skin texture; HD textures never go through the vanilla 64x64-only downloader. */
@Mixin(AbstractClientPlayer.class)
public abstract class AbstractClientPlayerMixin {
    @Inject(method = "getSkinTextureLocation", at = @At("RETURN"), cancellable = true)
    private void skinmod$texture(CallbackInfoReturnable<ResourceLocation> cir) {
        AbstractClientPlayer self = (AbstractClientPlayer) (Object) this;
        cir.setReturnValue(ClientSkins.overrideTexture(self.getUUID(), cir.getReturnValue()));
    }

    @Inject(method = "getModelName", at = @At("RETURN"), cancellable = true)
    private void skinmod$model(CallbackInfoReturnable<String> cir) {
        AbstractClientPlayer self = (AbstractClientPlayer) (Object) this;
        cir.setReturnValue(ClientSkins.overrideModel(self.getUUID(), cir.getReturnValue()));
    }
}
