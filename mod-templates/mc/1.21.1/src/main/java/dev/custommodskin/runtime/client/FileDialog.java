package dev.custommodskin.runtime.client;

import org.lwjgl.PointerBuffer;
import org.lwjgl.system.MemoryStack;
import org.lwjgl.util.tinyfd.TinyFileDialogs;

/** Native file picker via the tinyfd binding bundled with Minecraft. Returns null if cancelled/unavailable. */
final class FileDialog {
    private FileDialog() {}

    static String pickPng() {
        return pick("Choose a skin PNG", "*.png", "PNG image");
    }

    static String pickZip() {
        return pick("Choose a Figura avatar (.zip)", "*.zip", "ZIP archive");
    }

    private static String pick(String title, String pattern, String description) {
        try (MemoryStack stack = MemoryStack.stackPush()) {
            PointerBuffer filters = stack.mallocPointer(1);
            filters.put(stack.UTF8(pattern)).flip();
            return TinyFileDialogs.tinyfd_openFileDialog(title, "", filters, description, false);
        } catch (Throwable t) {
            return null; // drag & drop still works
        }
    }
}
