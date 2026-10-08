package dev.custommodskin.runtime.client;

import org.lwjgl.PointerBuffer;
import org.lwjgl.system.MemoryStack;
import org.lwjgl.util.tinyfd.TinyFileDialogs;

/** Native file picker via the tinyfd binding bundled with Minecraft. Returns null if cancelled/unavailable. */
final class FileDialog {
    private FileDialog() {}

    static String pickPng() {
        return pick("Choose a skin PNG", new String[] { "*.png" }, "PNG image");
    }


    private static String pick(String title, String[] patterns, String description) {
        try (MemoryStack stack = MemoryStack.stackPush()) {
            PointerBuffer filters = stack.mallocPointer(patterns.length);
            for (String p : patterns) filters.put(stack.UTF8(p));
            filters.flip();
            return TinyFileDialogs.tinyfd_openFileDialog(title, "", filters, description, false);
        } catch (Throwable t) {
            return null; // drag & drop still works
        }
    }
}
