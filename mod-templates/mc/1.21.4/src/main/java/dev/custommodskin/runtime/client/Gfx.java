package dev.custommodskin.runtime.client;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.client.renderer.RenderType;

/** GUI drawing calls whose signature differs between Minecraft versions. */
final class Gfx {
    private Gfx() {}

    /** Draws a region (u, v, rw x rh) of a texture (tw x th) scaled into a w x h box. */
    static void blit(GuiGraphics g, ResourceLocation tex, int x, int y, int w, int h, float u, float v, int rw, int rh, int tw, int th) {
        g.blit(RenderType::guiTextured, tex, x, y, u, v, w, h, rw, rh, tw, th);
    }
}
