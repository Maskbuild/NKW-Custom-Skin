package dev.custommodskin.runtime.client;

import org.lwjgl.PointerBuffer;
import org.lwjgl.system.MemoryStack;
import org.lwjgl.util.tinyfd.TinyFileDialogs;

/** Native file picker via the tinyfd binding bundled with Minecraft. Returns null if cancelled/unavailable. */
final class FileDialog {
    private FileDialog() {}

    static String pickPng() {
        try (MemoryStack stack = MemoryStack.stackPush()) {
            PointerBuffer filters = stack.mallocPointer(1);
            filters.put(stack.UTF8("*.png")).flip();
            return TinyFileDialogs.tinyfd_openFileDialog("Choose a skin PNG", "", filters, "PNG image", false);
        } catch (Throwable t) {
            return null; // drag & drop still works
        }
    }
}
