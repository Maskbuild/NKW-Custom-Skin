package dev.custommodskin.runtime.client;

import dev.custommodskin.runtime.SkinConfig;
import dev.custommodskin.runtime.SkinMod;
import dev.custommodskin.runtime.block.ZoneBlockEntity;
import dev.custommodskin.runtime.net.Messages;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.CommonComponents;
import net.minecraft.network.chat.Component;

/** Creative-only editor for a zone block: width / length / height, with the covered area shown live. */
public class ZoneScreen extends Screen {
    private static final String[] LABELS = {"Width (X)", "Length (Z)", "Height (Y)"};

    private final BlockPos pos;
    private final int[] size;

    public ZoneScreen(ZoneBlockEntity be) {
        super(Component.literal("Skin zone"));
        this.pos = be.getBlockPos();
        this.size = new int[]{be.width(), be.length(), be.height()};
    }

    private int rowY(int i) { return height / 2 - 50 + i * 30; }

    @Override
    protected void init() {
        int cx = width / 2;
        for (int i = 0; i < 3; i++) {
            final int axis = i;
            addRenderableWidget(Button.builder(Component.literal("-"), b -> change(axis, -(hasShiftDown() ? 5 : 1))).bounds(cx + 20, rowY(i), 20, 20).build());
            addRenderableWidget(Button.builder(Component.literal("+"), b -> change(axis, hasShiftDown() ? 5 : 1)).bounds(cx + 84, rowY(i), 20, 20).build());
        }
        addRenderableWidget(Button.builder(CommonComponents.GUI_DONE, b -> onClose()).bounds(cx - 50, rowY(3) + 14, 100, 20).build());
    }

    private void change(int axis, int delta) {
        size[axis] = Math.max(1, Math.min(SkinConfig.MAX_ZONE, size[axis] + delta));
    }

    @Override
    public boolean mouseScrolled(double mx, double my, double v) {
        // scroll over a row to resize it; hold Shift for steps of 5
        for (int i = 0; i < 3; i++) {
            if (my >= rowY(i) && my < rowY(i) + 20) {
                change(i, (int) Math.signum(v) * (hasShiftDown() ? 5 : 1));
                return true;
            }
        }
        return super.mouseScrolled(mx, my, v);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float delta) {
        renderBackground(g);
        super.render(g, mouseX, mouseY, delta);
        int cx = width / 2;
        g.drawCenteredString(font, title, cx, rowY(0) - 30, 0xFFFFFFFF);
        for (int i = 0; i < 3; i++) {
            g.drawString(font, LABELS[i], cx - 104, rowY(i) + 6, 0xFFDDDDDD);
            g.drawCenteredString(font, String.valueOf(size[i]), cx + 62, rowY(i) + 6, 0xFFFFFFFF);
        }
        double x0 = pos.getX() + 0.5 - size[0] / 2.0, x1 = pos.getX() + 0.5 + size[0] / 2.0;
        double z0 = pos.getZ() + 0.5 - size[1] / 2.0, z1 = pos.getZ() + 0.5 + size[1] / 2.0;
        String area = String.format("X %.1f → %.1f   Z %.1f → %.1f   Y %d → %d   (%d blocks)",
                x0, x1, z0, z1, pos.getY(), pos.getY() + size[2], size[0] * size[1] * size[2]);
        g.drawCenteredString(font, area, cx, rowY(3) + 42, 0xFF8FE3A8);
        g.drawCenteredString(font, "Scroll over a row to resize, Shift = ×5", cx, rowY(3) + 58, 0xFF999999);
    }

    @Override
    public void onClose() {
        if (SkinMod.platform.net().canSendToServer(Messages.ZoneConfig.class)) {
            SkinMod.platform.net().toServer(new Messages.ZoneConfig(pos, size[0], size[1], size[2]));
        }
        super.onClose();
    }
}
