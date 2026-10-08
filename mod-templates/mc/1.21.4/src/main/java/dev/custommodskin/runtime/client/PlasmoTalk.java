package dev.custommodskin.runtime.client;

import su.plo.voice.api.addon.AddonInitializer;
import su.plo.voice.api.addon.InjectPlasmoVoice;
import su.plo.voice.api.addon.annotation.Addon;
import su.plo.voice.api.client.PlasmoVoiceClient;
import su.plo.voice.api.client.audio.capture.ClientActivation;

/**
 * Plasmo Voice addon: reports whether the local player is talking. This class links against Plasmo Voice, so it is
 * only ever touched through {@link PlasmoBridge}, and only when Plasmo Voice is installed.
 */
@Addon(id = "pv-addon-skinmod", name = "Skin Mod talking skins", version = "1.0.0", authors = {"skinmod"})
public final class PlasmoTalk implements AddonInitializer {
    @InjectPlasmoVoice
    private PlasmoVoiceClient voice;

    @Override
    public void onAddonInitialize() {
        // voice is injected now; nothing to register, we poll in isTalking()
    }

    @Override
    public void onAddonShutdown() {
        voice = null;
    }

    boolean isTalking() {
        PlasmoVoiceClient v = voice;
        if (v == null) return false;
        try {
            for (ClientActivation a : v.getActivationManager().getActivations()) {
                if (a.isActive()) return true;
            }
        } catch (Throwable ignored) {
            // the mic or connection is not ready yet
        }
        return false;
    }
}
