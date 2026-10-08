package dev.custommodskin.runtime.mixin;

import com.mojang.authlib.GameProfile;
import dev.custommodskin.runtime.client.ClientSkins;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.resources.ResourceLocation;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Other mods (Figura, for one) read the skin from the player list entry, so it has to answer with the HD skin too. */
@Mixin(PlayerInfo.class)
public abstract class PlayerInfoMixin {
    @Shadow
    public abstract GameProfile getProfile();

    @Inject(method = "getSkinLocation", at = @At("RETURN"), cancellable = true)
    private void skinmod$texture(CallbackInfoReturnable<ResourceLocation> cir) {
        cir.setReturnValue(ClientSkins.overrideTexture(getProfile().getId(), cir.getReturnValue()));
    }

    @Inject(method = "getModelName", at = @At("RETURN"), cancellable = true)
    private void skinmod$model(CallbackInfoReturnable<String> cir) {
        cir.setReturnValue(ClientSkins.overrideModel(getProfile().getId(), cir.getReturnValue()));
    }
}
