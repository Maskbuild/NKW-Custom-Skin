package dev.custommodskin.runtime;

import dev.custommodskin.runtime.net.Messages;
import net.minecraft.resources.ResourceLocation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Loader-independent entry point; each loader layer calls {@link #init(Platform)} once. */
public final class SkinMod {
    /** Namespace of the mod assets, packets and registry entries (the mod id itself is set by the launcher). */
    public static final String ID = "skinmod";
    public static final Logger LOGGER = LoggerFactory.getLogger("CustomModSkin");

    public static Platform platform;

    private SkinMod() {}

    public static ResourceLocation id(String path) {
        return rl(ID, path);
    }

    /** A resource location of any namespace (for example Figura's own icon). */
    public static ResourceLocation rl(String namespace, String path) {
        return ResourceLocation.fromNamespaceAndPath(namespace, path);
    }

    public static void init(Platform p) {
        platform = p;
        Messages.register(p.net());
    }
}
