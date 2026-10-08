package dev.custommodskin.runtime.client;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/** Installs a Figura avatar from a .zip into figura/avatars, with the usual protections against hostile archives. */
public final class FiguraZip {
    private static final int MAX_ENTRIES = 3000;
    private static final long MAX_BYTES = 64L * 1024 * 1024;

    private FiguraZip() {}

    /** @return the name of the new folder inside figura/avatars */
    public static String install(Path zip) throws IOException {
        Path avatars = FiguraBridge.avatarsDir().toAbsolutePath().normalize();
        Files.createDirectories(avatars);
        String file = zip.getFileName().toString();
        String base = file.toLowerCase().endsWith(".zip") ? file.substring(0, file.length() - 4) : file;
        base = base.replaceAll("[^A-Za-z0-9._ -]", "_").replaceAll("^[. ]+", "").trim();
        if (base.isEmpty()) base = "avatar";

        try (ZipFile zf = new ZipFile(zip.toFile())) {
            List<? extends ZipEntry> entries = zf.stream().filter(e -> !e.isDirectory()).toList();
            if (entries.isEmpty()) throw new IOException("The zip is empty");
            if (entries.size() > MAX_ENTRIES) throw new IOException("The zip has too many files");
            for (ZipEntry e : entries) {
                String n = e.getName();
                if (n.startsWith("/") || n.contains("\\") || n.contains(":") || n.contains("..")) throw new IOException("Unsafe path in the zip: " + n);
            }
            String prefix = commonFolder(entries);
            boolean avatar = entries.stream().map(e -> e.getName().substring(prefix.length())).anyMatch(n -> n.equals("avatar.json") || n.endsWith(".bbmodel") || n.endsWith(".lua"));
            if (!avatar) throw new IOException("This zip is not a Figura avatar (no avatar.json, model or script)");

            Path target = unique(avatars, base);
            try {
                Files.createDirectories(target);
                long total = 0;
                for (ZipEntry e : entries) {
                    String rel = e.getName().substring(prefix.length());
                    if (rel.isEmpty()) continue;
                    Path out = target.resolve(rel).normalize();
                    if (!out.startsWith(target)) throw new IOException("Unsafe path in the zip: " + e.getName());
                    Files.createDirectories(out.getParent());
                    try (InputStream in = zf.getInputStream(e); OutputStream o = Files.newOutputStream(out)) {
                        byte[] buf = new byte[16384];
                        int n;
                        while ((n = in.read(buf)) > 0) {
                            total += n;
                            if (total > MAX_BYTES) throw new IOException("The avatar is larger than " + (MAX_BYTES >> 20) + " MB");
                            o.write(buf, 0, n);
                        }
                    }
                }
            } catch (IOException | RuntimeException ex) {
                deleteTree(target); // never leave a half-installed avatar behind
                throw ex;
            }
            return target.getFileName().toString();
        }
    }

    /** "folder/" when every file sits inside one folder (the usual way to zip a folder), otherwise "". */
    private static String commonFolder(List<? extends ZipEntry> entries) {
        Set<String> firsts = new HashSet<>();
        for (ZipEntry e : entries) {
            int i = e.getName().indexOf('/');
            if (i < 0) return "";
            firsts.add(e.getName().substring(0, i));
        }
        return firsts.size() == 1 ? firsts.iterator().next() + "/" : "";
    }

    private static Path unique(Path dir, String base) {
        Path p = dir.resolve(base).normalize();
        for (int i = 2; Files.exists(p); i++) p = dir.resolve(base + "_" + i).normalize();
        return p;
    }

    private static void deleteTree(Path root) {
        try (Stream<Path> s = Files.walk(root)) {
            s.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        } catch (IOException ignored) {
            // nothing more to do
        }
    }
}
