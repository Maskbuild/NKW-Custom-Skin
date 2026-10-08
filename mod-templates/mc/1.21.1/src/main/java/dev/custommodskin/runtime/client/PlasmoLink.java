package dev.custommodskin.runtime.client;

import dev.custommodskin.runtime.SkinMod;
import su.plo.voice.api.client.PlasmoVoiceClient;

/** The part of the Plasmo Voice support that links against Plasmo classes. Only loaded via {@link PlasmoBridge}. */
final class PlasmoLink {
    private static PlasmoTalk addon;

    private PlasmoLink() {}

    static boolean init() {
        try {
            addon = new PlasmoTalk();
            PlasmoVoiceClient.getAddonsLoader().load(addon);
            return true;
        } catch (Throwable t) {
            addon = null;
            SkinMod.LOGGER.warn("Could not hook into Plasmo Voice; talking skins are off", t);
            return false;
        }
    }

    static boolean talking() {
        PlasmoTalk a = addon;
        return a != null && a.isTalking();
    }
}
