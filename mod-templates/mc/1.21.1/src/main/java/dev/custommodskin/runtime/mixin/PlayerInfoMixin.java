package dev.custommodskin.runtime.mixin;

import com.mojang.authlib.GameProfile;
import dev.custommodskin.runtime.client.ClientSkins;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.client.resources.PlayerSkin;
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

    @Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
    private void skinmod$skin(CallbackInfoReturnable<PlayerSkin> cir) {
        cir.setReturnValue(ClientSkins.override(getProfile().getId(), cir.getReturnValue()));
    }
}
