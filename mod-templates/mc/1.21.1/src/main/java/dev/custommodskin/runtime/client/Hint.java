package dev.custommodskin.runtime.client;

import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;

/**
 * The one-line message above the hotbar (zone hint, skin block hint). It appears on the first tick the condition is
 * true and is wiped on the first tick it is not, instead of fading after three seconds.
 */
final class Hint {
    private static boolean shown;
    private static int refresh;

    private Hint() {}

    /** @param text what to show now, or null when nothing should be shown */
    static void update(Minecraft mc, Component text) {
        if (text == null) {
            if (shown) {
                mc.gui.setOverlayMessage(Component.empty(), false);
                shown = false;
            }
            return;
        }
        if (!shown || --refresh <= 0) { // keep it alive: the game hides an overlay message after 60 ticks
            mc.gui.setOverlayMessage(text, false);
            shown = true;
            refresh = 30;
        }
    }

    static void reset() {
        shown = false;
    }
}
