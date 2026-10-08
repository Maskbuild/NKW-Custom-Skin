package dev.custommodskin.runtime.client;

import dev.custommodskin.runtime.SkinConfig;
import dev.custommodskin.runtime.SkinMod;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.inventory.InventoryScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.LivingEntity;
import org.joml.Quaternionf;
import org.joml.Vector3f;

import java.nio.file.Path;
import java.util.List;

/** Wardrobe window: outfit list | big rotatable preview | name + actions. Vanilla blurs what is behind it. */
public class SkinScreen extends Screen {
    static final ResourceLocation FIGURA_ICON = SkinMod.id("textures/gui/figura.png");
    /** Figura's own logo, used while Figura is installed. */
    private static final ResourceLocation FIGURA_LOGO = SkinMod.rl("figura", "icon.png");
    private static Boolean figuraLogo;
    static final ResourceLocation MIC_ICON = SkinMod.id("textures/gui/mic.png");

    private static final int ROW_H = 26;
    private static final int PANEL = 0x99101418;
    private static final int PANEL_EDGE = 0x33FFFFFF;
    private static final int ACCENT = 0xCC3A7BD5;
    private static final int GREY = 0xFF8C9199;

    private Wardrobe.Outfit current;
    private int scroll = 0;
    private float yaw = 0.35f;     // radians, free 360° turn
    private float zoom = 1.0f;
    private String status = "";

    private EditBox nameField;
    private Button modelBtn, figuraBtn, talkBtn, talkClearBtn, applyBtn, deleteBtn, addBtn, resetBtn;

    private Path figuraBefore;      // avatar Figura had when the window opened
    private boolean figuraTouched;  // the preview changed the loaded avatar
    private String previewedFigura = "";

    public SkinScreen() {
        super(Component.translatable("skinmod.title"));
    }

    // ---- layout -------------------------------------------------------------------------------

    private int top() { return 38; }
    private int bottom() { return height - 14; }
    private int listX() { return 14; }
    private int listW() { return Math.max(170, Math.min(230, width / 4)); }
    private int rightW() { return Math.max(170, Math.min(220, width / 4)); }
    private int rightX() { return width - 14 - rightW(); }
    private int previewX1() { return listX() + listW() + 10; }
    private int previewX2() { return rightX() - 10; }
    private int listTop() { return top() + 30; }

    @Override
    protected void init() {
        if (current == null) current = Wardrobe.selected();
        if (figuraBefore == null && SkinConfig.figuraEnabled()) figuraBefore = FiguraBridge.current();

        // outfit faces need their textures
        for (Wardrobe.Outfit o : Wardrobe.list()) {
            ensureTexture(o);
        }

        addBtn = addRenderableWidget(Button.builder(Component.translatable("skinmod.add"), b -> {
            String path = FileDialog.pickPng();
            if (path != null) addFile(Path.of(path));
        }).bounds(listX() + 6, top() + 6, listW() - 12, 20).build());

        int rx = rightX() + 8, rw = rightW() - 16;
        int y = top() + 22;
        nameField = new EditBox(font, rx, y, rw, 20, Component.empty());
        nameField.setMaxLength(32);
        nameField.setResponder(s -> { if (current != null && !current.preset) Wardrobe.rename(current, s); });
        addRenderableWidget(nameField);
        y += 28;

        modelBtn = addRenderableWidget(Button.builder(Component.empty(), b -> {
            if (current == null) return;
            Wardrobe.setSlim(current, !current.slim);
            refresh();
        }).bounds(rx, y, rw, 20).build());
        y += 24;

        if (SkinConfig.figuraEnabled()) {
            figuraBtn = addRenderableWidget(Button.builder(Component.empty(), b -> {
                if (current != null && !current.preset) minecraft.setScreen(new FiguraPicker(this, current));
            }).bounds(rx, y, rw, 20).build());
            y += 24;
        }
        if (SkinConfig.plasmoEnabled()) {
            talkBtn = addRenderableWidget(Button.builder(Component.empty(), b -> {
                if (current == null || current.preset) return;
                String path = FileDialog.pickPng();
                if (path == null) return;
                String err = Wardrobe.setOpen(current, Path.of(path));
                status = err == null ? "" : errorText(err);
                refresh();
            }).bounds(rx, y, rw - 24, 20).build());
            talkClearBtn = addRenderableWidget(Button.builder(Component.literal("✕"), b -> {
                if (current != null) { Wardrobe.setOpen(current, null); refresh(); }
            }).bounds(rx + rw - 20, y, 20, 20).build());
        }

        applyBtn = addRenderableWidget(Button.builder(Component.translatable("skinmod.apply"), b -> {
            if (current != null) { Wardrobe.apply(current); refresh(); }
        }).bounds(rx, bottom() - 78, rw, 20).build());
        deleteBtn = addRenderableWidget(Button.builder(Component.translatable("skinmod.delete"), b -> {
            if (current == null) return;
            Wardrobe.remove(current);
            current = null;
            ClientSkins.setPreview(null);
            refresh();
        }).bounds(rx, bottom() - 54, rw, 20).build());
        resetBtn = addRenderableWidget(Button.builder(Component.translatable("skinmod.reset"), b -> {
            Wardrobe.reset();
            refresh();
        }).bounds(rx, bottom() - 30, rw, 20).tooltip(Tooltip.create(Component.translatable("skinmod.reset_tip"))).build());

        refresh();
    }

    /** Loads an outfit texture once; reading and uploading a 2048 px PNG every refresh would stutter. */
    private static void ensureTexture(Wardrobe.Outfit o) {
        if (ClientSkins.isRegistered(o.hash)) return;
        try { ClientSkins.registerTexture(o.hash, Wardrobe.bytes(o)); } catch (Exception ignored) { /* unreadable file: the face stays blank */ }
    }

    private String errorText(String err) {
        if (err.equals("limit")) return Component.translatable("skinmod.limit", SkinConfig.maxSkins()).getString();
        if (err.startsWith("bad_size")) {
            String[] s = err.split(":");
            return Component.translatable("skinmod.bad_size", s[1], s[2]).getString();
        }
        return err;
    }

    private void refresh() {
        boolean has = current != null;
        boolean own = has && !current.preset;
        // with nothing selected the detail widgets disappear instead of showing empty boxes
        nameField.visible = has;
        modelBtn.visible = has;
        if (figuraBtn != null) figuraBtn.visible = has;
        if (talkBtn != null) { talkBtn.visible = has; talkClearBtn.visible = has; }
        resetBtn.active = Wardrobe.wearingAny();
        nameField.setEditable(own);
        applyBtn.active = has;
        deleteBtn.active = own;
        modelBtn.active = own;
        addBtn.active = !Wardrobe.full();
        addBtn.setTooltip(Wardrobe.full() ? Tooltip.create(Component.translatable("skinmod.limit", SkinConfig.maxSkins())) : null);

        if (has) {
            if (!nameField.getValue().equals(current.name)) nameField.setValue(current.name);
            modelBtn.setMessage(Component.translatable(current.slim ? "skinmod.slim" : "skinmod.classic"));
            ClientSkins.setPreview(new ClientSkins.Use(current.hash, current.slim));
            ensureTexture(current);
        } else {
            nameField.setValue("");
            modelBtn.setMessage(Component.empty());
            ClientSkins.setPreview(null);
        }

        if (figuraBtn != null) {
            boolean installed = FiguraBridge.installed();
            figuraBtn.active = own && installed;
            String set = has ? current.figura : "";
            figuraBtn.setMessage(Component.translatable(!installed ? "skinmod.figura_missing" : set.isEmpty() ? "skinmod.figura_none" : "skinmod.figura_set", set));
            figuraBtn.setTooltip(Tooltip.create(Component.translatable("skinmod.figura_tip")));
            if (has && installed && !set.isEmpty() && !set.equals(previewedFigura) && FiguraBridge.load(set, false)) {
                figuraTouched = true;
                previewedFigura = set;
            }
        }
        if (talkBtn != null) {
            boolean has2 = has && !current.openHash.isEmpty();
            talkBtn.active = own;
            talkClearBtn.active = own && has2;
            talkBtn.setMessage(Component.translatable(has2 ? "skinmod.talk_set" : "skinmod.talk_none"));
            talkBtn.setTooltip(Tooltip.create(Component.translatable(PlasmoBridge.installed() ? "skinmod.talk_tip" : "skinmod.talk_tip_missing")));
            if (has2 && !ClientSkins.isRegistered(current.openHash)) {
                byte[] open = Wardrobe.openBytes(current);
                if (open != null) ClientSkins.registerTexture(current.openHash, open);
            }
        }
    }

    private void addFile(Path p) {
        String err = Wardrobe.add(p);
        if (err == null) {
            List<Wardrobe.Outfit> l = Wardrobe.list();
            current = l.get(l.size() - 1);
            status = "";
            ensureTexture(current);
            refresh();
            scrollTo(l.size() - 1);
        } else {
            status = errorText(err);
        }
    }

    private void scrollTo(int index) {
        int visible = (bottom() - listTop() - 6) / ROW_H;
        if (index < scroll / ROW_H) scroll = index * ROW_H;
        else if (index >= scroll / ROW_H + visible) scroll = (index - visible + 1) * ROW_H;
    }

    void onFiguraPicked(Wardrobe.Outfit o, String avatar) {
        Wardrobe.setFigura(o, avatar);
        minecraft.setScreen(this);
        refresh();
    }

    @Override
    public void onFilesDrop(List<Path> paths) {
        for (Path p : paths) {
            if (p.toString().toLowerCase().endsWith(".png")) addFile(p);
        }
    }

    // ---- drawing ------------------------------------------------------------------------------

    /** The Figura logo (64 px) when Figura is there, else our own small stand-in. */
    static void drawFiguraIcon(GuiGraphics g, int x, int y, int size) {
        if (figuraLogo == null) figuraLogo = FiguraBridge.installed() && Minecraft.getInstance().getResourceManager().getResource(FIGURA_LOGO).isPresent();
        if (figuraLogo) Gfx.blit(g, FIGURA_LOGO, x, y, size, size, 0, 0, 64, 64, 64, 64);
        else Gfx.blit(g, FIGURA_ICON, x, y, size, size, 0, 0, 16, 16, 16, 16);
    }

    private static void panel(GuiGraphics g, int x1, int y1, int x2, int y2) {
        g.fill(x1, y1, x2, y2, PANEL);
        g.fill(x1, y1, x2, y1 + 1, PANEL_EDGE);
        g.fill(x1, y2 - 1, x2, y2, PANEL_EDGE);
        g.fill(x1, y1, x1 + 1, y2, PANEL_EDGE);
        g.fill(x2 - 1, y1, x2, y2, PANEL_EDGE);
    }

    /** The face of a skin (base + hat layer) at any texture size. */
    static void drawFace(GuiGraphics g, String hash, int x, int y, int size) {
        ResourceLocation tex = ClientSkins.textureOf(hash);
        int[] wh = ClientSkins.sizeOf(hash);
        if (tex == null || wh == null) { g.fill(x, y, x + size, y + size, 0x55FFFFFF); return; }
        float s = wh[0] / 64f;
        int f = Math.round(8 * s);
        Gfx.blit(g, tex, x, y, size, size, 8 * s, 8 * s, f, f, wh[0], wh[1]);
        Gfx.blit(g, tex, x, y, size, size, 40 * s, 8 * s, f, f, wh[0], wh[1]);
    }

    /** Blurred world, then our panels; the widgets are drawn after this, on top of the panels. */
    @Override
    public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float delta) {
        super.renderBackground(g, mouseX, mouseY, delta);

        g.drawString(font, title, listX(), 14, 0xFFFFFFFF);
        int max = SkinConfig.maxSkins();
        String count = Component.translatable("skinmod.count", Wardrobe.ownCount(), max < 0 ? "∞" : String.valueOf(max)).getString();
        g.drawString(font, count, width - 14 - font.width(count), 14, GREY);

        drawList(g, mouseX, mouseY);
        drawPreview(g);
        drawDetails(g);

        if (!status.isEmpty()) g.drawCenteredString(font, status, width / 2, height - 12, 0xFFFF6B6B);
    }

    private void drawList(GuiGraphics g, int mouseX, int mouseY) {
        int lx = listX(), lw = listW(), top = top(), bottom = bottom();
        panel(g, lx, top, lx + lw, bottom);
        int ly = listTop(), lb = bottom - 4;
        List<Wardrobe.Outfit> outfits = Wardrobe.list();
        if (outfits.isEmpty()) {
            g.drawCenteredString(font, Component.translatable("skinmod.empty"), lx + lw / 2, ly + 14, GREY);
            return;
        }
        g.enableScissor(lx + 1, ly, lx + lw - 1, lb);
        for (int i = 0; i < outfits.size(); i++) {
            int y = ly + i * ROW_H - scroll;
            if (y + ROW_H < ly || y > lb) continue;
            Wardrobe.Outfit o = outfits.get(i);
            boolean sel = o == current;
            boolean hover = mouseX >= lx && mouseX < lx + lw && mouseY >= Math.max(y, ly) && mouseY < Math.min(y + ROW_H - 2, lb);
            g.fill(lx + 4, y, lx + lw - 4, y + ROW_H - 2, sel ? ACCENT : hover ? 0x33FFFFFF : 0x1AFFFFFF);
            drawFace(g, o.hash, lx + 8, y + 4, 16);
            String name = (o.preset ? "★ " : "") + o.name;
            int icons = (SkinConfig.figuraEnabled() && !o.figura.isEmpty() ? 14 : 0) + (SkinConfig.plasmoEnabled() && !o.openHash.isEmpty() ? 14 : 0);
            String shown = font.plainSubstrByWidth(name, lw - 8 - 22 - 12 - icons);
            g.drawString(font, shown, lx + 30, y + 9, 0xFFFFFFFF);
            int ix = lx + 30 + font.width(shown) + 4;
            if (SkinConfig.figuraEnabled() && !o.figura.isEmpty()) {
                drawFiguraIcon(g, ix, y + 6, 12);
                ix += 14;
            }
            if (SkinConfig.plasmoEnabled() && !o.openHash.isEmpty()) {
                Gfx.blit(g, MIC_ICON, ix, y + 6, 12, 12, 0, 0, 16, 16, 16, 16);
            }
        }
        g.disableScissor();
        int total = outfits.size() * ROW_H, view = lb - ly;
        if (total > view) { // slim scroll bar
            int barH = Math.max(18, view * view / total);
            int barY = ly + (int) ((long) (view - barH) * scroll / (total - view));
            g.fill(lx + lw - 4, barY, lx + lw - 2, barY + barH, 0x66FFFFFF);
        }
    }

    private void drawPreview(GuiGraphics g) {
        int x1 = previewX1(), x2 = previewX2(), y1 = top(), y2 = bottom();
        panel(g, x1, y1, x2, y2);
        if (minecraft == null || minecraft.player == null || x2 <= x1) return;

        LivingEntity e = minecraft.player;
        float by = e.yBodyRot, pby = e.yBodyRotO, hy = e.yHeadRot, phy = e.yHeadRotO, yw = e.getYRot(), pyw = e.yRotO, pt = e.getXRot(), ppt = e.xRotO;
        e.yBodyRot = e.yBodyRotO = 180f;
        e.yHeadRot = e.yHeadRotO = 180f;
        e.setYRot(180f); e.yRotO = 180f;
        e.setXRot(0f); e.xRotO = 0f;

        int h = y2 - y1;
        float size = h * 0.40f * zoom;
        float cx = (x1 + x2) / 2f, cy = y1 + h * 0.52f;
        Quaternionf q = new Quaternionf().rotateZ((float) Math.PI).rotateY(yaw);
        g.enableScissor(x1 + 1, y1 + 1, x2 - 1, y2 - 1);
        InventoryScreen.renderEntityInInventory(g, cx, cy, size, new Vector3f(0f, e.getBbHeight() / 2f + 0.0625f, 0f), q, new Quaternionf(), e);
        g.disableScissor();

        e.yBodyRot = by; e.yBodyRotO = pby; e.yHeadRot = hy; e.yHeadRotO = phy;
        e.setYRot(yw); e.yRotO = pyw; e.setXRot(pt); e.xRotO = ppt;

        // hints, grey and quiet
        g.drawCenteredString(font, Component.translatable("skinmod.drop_hint"), (x1 + x2) / 2, y2 - 22, GREY);
        g.drawCenteredString(font, Component.translatable("skinmod.rotate_hint"), (x1 + x2) / 2, y2 - 11, 0xFF5E636B);
    }

    private void drawDetails(GuiGraphics g) {
        int x1 = rightX(), x2 = x1 + rightW(), y1 = top(), y2 = bottom();
        panel(g, x1, y1, x2, y2);
        if (current == null) {
            g.drawCenteredString(font, Component.translatable("skinmod.pick"), (x1 + x2) / 2, y1 + 24, GREY);
        } else {
            g.drawString(font, Component.translatable("skinmod.name"), x1 + 8, y1 + 8, GREY);
            int[] wh = ClientSkins.sizeOf(current.hash);
            if (wh != null) {
                String size = wh[0] + " × " + wh[1] + (current.preset ? "  ★" : "");
                g.drawString(font, size, x1 + 8, y2 - 92, GREY);
            }
        }
    }

    // ---- input --------------------------------------------------------------------------------

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        if (super.mouseClicked(mx, my, button)) return true;
        int lx = listX(), lw = listW();
        if (mx >= lx && mx < lx + lw && my >= listTop() && my < bottom() - 4) {
            int i = (int) ((my - listTop() + scroll) / ROW_H);
            List<Wardrobe.Outfit> l = Wardrobe.list();
            if (i >= 0 && i < l.size()) { current = l.get(i); refresh(); return true; }
        }
        return false;
    }

    @Override
    public boolean mouseDragged(double mx, double my, int button, double dx, double dy) {
        if (mx >= previewX1() && mx <= previewX2() && my >= top() && my <= bottom()) {
            yaw = (float) ((yaw + dx * 0.012) % (Math.PI * 2)); // wraps: turn as far as you like
            return true;
        }
        return super.mouseDragged(mx, my, button, dx, dy);
    }

    @Override
    public boolean mouseScrolled(double mx, double my, double h, double v) {
        if (mx >= previewX1() && mx <= previewX2()) {
            zoom = (float) Math.max(0.6, Math.min(1.7, zoom + v * 0.08));
            return true;
        }
        int max = Math.max(0, Wardrobe.list().size() * ROW_H - (bottom() - 4 - listTop()));
        scroll = (int) Math.max(0, Math.min(max, scroll - v * ROW_H));
        return true;
    }

    @Override
    public void onClose() {
        ClientSkins.setPreview(null);
        ZoneClient.windowClosed();
        restoreFigura();
        super.onClose();
    }

    /** Puts the worn outfit Figura avatar (or the one from before) back after previewing others. */
    private void restoreFigura() {
        if (!figuraTouched || !SkinConfig.figuraEnabled()) return;
        Wardrobe.Outfit worn = Wardrobe.selected();
        if (worn != null && !worn.figura.isEmpty()) FiguraBridge.load(worn.figura, true);
        else if (figuraBefore != null) FiguraBridge.load(figuraBefore, true);
    }

    @Override
    public boolean isPauseScreen() { return false; }
}
