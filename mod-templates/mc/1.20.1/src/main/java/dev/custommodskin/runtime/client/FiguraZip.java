package dev.custommodskin.runtime.client;

import be.stef.rar.ExtractionResult;
import be.stef.rar.Unrar5j;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/** Installs a Figura avatar from a .zip or .rar into figura/avatars, with protections against hostile archives. */
public final class FiguraZip {
    private static final int MAX_ENTRIES = 3000;
    private static final long MAX_BYTES = 64L * 1024 * 1024;

    private FiguraZip() {}

    /** @return the name of the new folder inside figura/avatars */
    public static String install(Path archive) throws IOException {
        Path avatars = FiguraBridge.avatarsDir().toAbsolutePath().normalize();
        Files.createDirectories(avatars);
        String file = archive.getFileName().toString();
        String lower = file.toLowerCase();
        String base = lower.endsWith(".zip") ? file.substring(0, file.length() - 4)
                : lower.endsWith(".rar") ? file.substring(0, file.length() - 4) : file;
        base = base.replaceAll("[^A-Za-z0-9._ -]", "_").replaceAll("^[. ]+", "").trim();
        if (base.isEmpty()) base = "avatar";

        if (lower.endsWith(".rar") || isRarFile(archive)) {
            return installRar(archive, avatars, base);
        } else {
            return installZip(archive, avatars, base);
        }
    }

    private static boolean isRarFile(Path archive) {
        try {
            return Unrar5j.detectFormat(archive.toAbsolutePath().toString()) != Unrar5j.FORMAT_UNKNOWN;
        } catch (Throwable t) {
            return false;
        }
    }

    private static String installZip(Path zip, Path avatars, String base) throws IOException {
        try (ZipFile zf = new ZipFile(zip.toFile())) {
            List<? extends ZipEntry> entries = zf.stream().filter(e -> !e.isDirectory()).toList();
            if (entries.isEmpty()) throw new IOException("The zip is empty");
            if (entries.size() > MAX_ENTRIES) throw new IOException("The zip has too many files");
            for (ZipEntry e : entries) {
                String n = e.getName();
                if (n.startsWith("/") || n.contains("\\") || n.contains(":") || n.contains("..")) throw new IOException("Unsafe path in the zip: " + n);
            }
            List<String> names = entries.stream().map(ZipEntry::getName).toList();
            String prefix = commonFolder(names);
            boolean avatar = names.stream().map(n -> n.substring(prefix.length())).anyMatch(n -> n.equals("avatar.json") || n.endsWith(".bbmodel") || n.endsWith(".lua"));
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

    private static String installRar(Path rar, Path avatars, String base) throws IOException {
        String rarPath = rar.toAbsolutePath().toString();
        try {
            if (Unrar5j.isEncrypted(rarPath)) throw new IOException("Encrypted RAR archives are not supported");
        } catch (IOException ex) {
            throw ex;
        } catch (Throwable t) {
            // ignore and proceed to extraction
        }

        Path tempDir = Files.createTempDirectory("figura_rar_");
        try {
            ExtractionResult result = Unrar5j.extract(rarPath, tempDir.toAbsolutePath().toString(), null);
            if (result == null || (result.totalFiles == 0 && result.unpackedFiles.isEmpty())) {
                throw new IOException("The rar is empty or could not be read");
            }
            if (result.errorCount > 0 && result.unpackedFiles.isEmpty()) {
                String msg = result.errors.isEmpty() ? "Failed to extract RAR" : result.errors.get(0).toString();
                throw new IOException(msg);
            }

            List<Path> files;
            try (Stream<Path> s = Files.walk(tempDir)) {
                files = s.filter(Files::isRegularFile).toList();
            }
            if (files.isEmpty()) throw new IOException("The rar is empty");
            if (files.size() > MAX_ENTRIES) throw new IOException("The rar has too many files");

            long total = 0;
            for (Path f : files) {
                total += Files.size(f);
                if (total > MAX_BYTES) throw new IOException("The avatar is larger than " + (MAX_BYTES >> 20) + " MB");
            }

            List<String> relPaths = new ArrayList<>();
            for (Path f : files) {
                Path rel = tempDir.relativize(f);
                String n = rel.toString().replace('\\', '/');
                if (n.startsWith("/") || n.contains(":") || n.contains("..")) throw new IOException("Unsafe path in the rar: " + n);
                relPaths.add(n);
            }

            String prefix = commonFolder(relPaths);
            boolean avatar = relPaths.stream().map(n -> n.substring(prefix.length())).anyMatch(n -> n.equals("avatar.json") || n.endsWith(".bbmodel") || n.endsWith(".lua"));
            if (!avatar) throw new IOException("This rar is not a Figura avatar (no avatar.json, model or script)");

            Path target = unique(avatars, base);
            try {
                Files.createDirectories(target);
                for (Path f : files) {
                    Path rel = tempDir.relativize(f);
                    String n = rel.toString().replace('\\', '/');
                    String sub = n.substring(prefix.length());
                    if (sub.isEmpty()) continue;
                    Path out = target.resolve(sub).normalize();
                    if (!out.startsWith(target)) throw new IOException("Unsafe path in the rar: " + n);
                    Files.createDirectories(out.getParent());
                    Files.move(f, out, StandardCopyOption.REPLACE_EXISTING);
                }
            } catch (IOException | RuntimeException ex) {
                deleteTree(target);
                throw ex;
            }
            return target.getFileName().toString();
        } finally {
            deleteTree(tempDir);
        }
    }

    /** "folder/" when every file sits inside one folder (the usual way to archive a folder), otherwise "". */
    private static String commonFolder(List<String> names) {
        Set<String> firsts = new HashSet<>();
        for (String n : names) {
            int i = n.indexOf('/');
            if (i < 0) return "";
            firsts.add(n.substring(0, i));
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
