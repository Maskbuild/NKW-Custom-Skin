package dev.custommodskin.runtime.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.toasts.SystemToast;
import net.minecraft.network.chat.Component;

/** The small notifications in the top right corner of the screen. */
final class Toasts {
    private Toasts() {}

    static void show(String title, String message) {
        Minecraft mc = Minecraft.getInstance();
        mc.execute(() -> mc.getToastManager().addToast(new SystemToast(SystemToast.SystemToastId.PERIODIC_NOTIFICATION, Component.literal(title), Component.literal(message))));
    }
}
