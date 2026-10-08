package dev.custommodskin.runtime.client;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

import java.util.ArrayList;
import java.util.List;

/** Pick which Figura avatar goes with an outfit (folders in figura/avatars). */
public class FiguraPicker extends Screen {
    private static final int ROW_H = 20;

    private final SkinScreen parent;
    private final Wardrobe.Outfit outfit;
    private final List<String> names = new ArrayList<>();
    private int scroll = 0;

    FiguraPicker(SkinScreen parent, Wardrobe.Outfit outfit) {
        super(Component.translatable("skinmod.figura_pick"));
        this.parent = parent;
        this.outfit = outfit;
        names.add(""); // "none"
        names.addAll(FiguraBridge.list());
    }

    private int x1() { return width / 2 - 130; }
    private int x2() { return width / 2 + 130; }
    private int y1() { return 40; }
    private int y2() { return height - 44; }

    @Override
    protected void init() {
        addRenderableWidget(Button.builder(Component.translatable("gui.cancel"), b -> minecraft.setScreen(parent))
                .bounds(width / 2 - 50, height - 34, 100, 20).build());
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float delta) {
        super.render(g, mouseX, mouseY, delta);
        g.drawCenteredString(font, title, width / 2, 18, 0xFFFFFFFF);
        g.fill(x1(), y1(), x2(), y2(), 0x99101418);
        g.enableScissor(x1(), y1(), x2(), y2());
        for (int i = 0; i < names.size(); i++) {
            int y = y1() + 4 + i * ROW_H - scroll;
            String n = names.get(i);
            boolean sel = n.equals(outfit.figura);
            boolean hover = mouseX >= x1() && mouseX < x2() && mouseY >= y && mouseY < y + ROW_H - 2 && mouseY < y2();
            g.fill(x1() + 4, y, x2() - 4, y + ROW_H - 2, sel ? 0xCC3A7BD5 : hover ? 0x33FFFFFF : 0x1AFFFFFF);
            if (!n.isEmpty()) Gfx.blit(g, SkinScreen.FIGURA_ICON, x1() + 8, y + 3, 12, 12, 0, 0, 16, 16, 16, 16);
            String label = n.isEmpty() ? Component.translatable("skinmod.figura_use_current").getString() : n;
            g.drawString(font, font.plainSubstrByWidth(label, 220), x1() + 26, y + 5, n.isEmpty() ? 0xFF8C9199 : 0xFFFFFFFF);
        }
        g.disableScissor();
        if (names.size() == 1) {
            g.drawCenteredString(font, Component.translatable("skinmod.figura_empty"), width / 2, y1() + 44, 0xFF8C9199);
        }
    }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        if (super.mouseClicked(mx, my, button)) return true;
        if (mx >= x1() && mx < x2() && my >= y1() && my < y2()) {
            int i = (int) ((my - y1() - 4 + scroll) / ROW_H);
            if (i >= 0 && i < names.size()) { parent.onFiguraPicked(outfit, names.get(i)); return true; }
        }
        return false;
    }

    @Override
    public boolean mouseScrolled(double mx, double my, double h, double v) {
        int max = Math.max(0, names.size() * ROW_H + 8 - (y2() - y1()));
        scroll = (int) Math.max(0, Math.min(max, scroll - v * ROW_H));
        return true;
    }

    @Override
    public void onClose() { minecraft.setScreen(parent); }
}
