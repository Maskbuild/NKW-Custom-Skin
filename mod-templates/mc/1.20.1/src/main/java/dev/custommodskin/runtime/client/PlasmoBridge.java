package dev.custommodskin.runtime.client;

import dev.custommodskin.runtime.SkinMod;

/**
 * Optional Plasmo Voice support. This class itself never names a Plasmo type, so it is safe to load without Plasmo
 * Voice; the linking code lives in {@link PlasmoLink} and is only reached after the mod-loaded check.
 */
public final class PlasmoBridge {
    private static boolean active;

    private PlasmoBridge() {}

    public static boolean installed() { return SkinMod.platform.isModLoaded("plasmovoice"); }

    public static void init() {
        if (installed()) active = PlasmoLink.init();
    }

    /** Every client tick. */
    public static void tick() {
        if (active) ClientSkins.setLocalSpeaking(PlasmoLink.talking());
    }
}
