package dev.custommodskin.runtime;

import java.nio.ByteBuffer;

/** Cheap PNG header validation (no decoding) so the server never decodes untrusted images. */
public final class PngInfo {
    private static final byte[] SIG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    private static final int[] SIZES = {64, 128, 256, 512, 1024, 2048};

    public final int width;
    public final int height;

    private PngInfo(int w, int h) { width = w; height = h; }

    /** @return header info, or null if not a PNG. */
    public static PngInfo read(byte[] data) {
        if (data == null || data.length < 33) return null;
        for (int i = 0; i < SIG.length; i++) if (data[i] != SIG[i]) return null;
        ByteBuffer b = ByteBuffer.wrap(data);
        if (b.getInt(12) != 0x49484452) return null; // IHDR
        return new PngInfo(b.getInt(16), b.getInt(20));
    }

    /** A skin id as the mod makes it: the lowercase hex SHA-256 of the PNG. Anything else never touches the disk. */
    public static boolean validHash(String hash) {
        if (hash == null || hash.length() != 64) return false;
        for (int i = 0; i < 64; i++) {
            char c = hash.charAt(i);
            if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
        }
        return true;
    }

    /** Square power-of-two skins 64..2048, plus legacy 64x32. */
    public boolean supported() {
        if (width == 64 && height == 32) return true;
        if (width != height) return false;
        for (int s : SIZES) if (s == width) return true;
        return false;
    }
}
