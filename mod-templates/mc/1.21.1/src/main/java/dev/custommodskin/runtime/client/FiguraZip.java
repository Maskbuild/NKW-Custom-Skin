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

/**
 * Resolves Figura avatars stored as .zip or .rar files in figura/avatars by extracting
 * them into a cached directory inside figura/avatars/.cache/<filename>, with protections against hostile archives.
 */
public final class FiguraZip {
    private static final int MAX_ENTRIES = 3000;
    private static final long MAX_BYTES = 64L * 1024 * 1024;

    private FiguraZip() {}

    /**
     * Resolves an archive path (.zip or .rar) to its extracted avatar directory in figura/avatars/.cache/.
     * Reuses previously extracted directory if the archive's modification time and size have not changed.
     *
     * @return Path to the extracted avatar directory ready for Figura's loader
     */
    public static Path resolve(Path archive) throws IOException {
        if (archive == null || !Files.exists(archive)) return null;
        String fileName = archive.getFileName().toString();
        String lower = fileName.toLowerCase();
        if (!lower.endsWith(".zip") && !lower.endsWith(".rar") && !isRarFile(archive)) {
            return archive;
        }

        Path avatars = FiguraBridge.avatarsDir().toAbsolutePath().normalize();
        Path cacheRoot = avatars.resolve(".cache");
        Path cacheDir = cacheRoot.resolve(fileName);

        Path marker = cacheDir.resolve(".extracted");
        long mtime = Files.getLastModifiedTime(archive).toMillis();
        long size = Files.size(archive);
        String expectedTag = mtime + ":" + size;

        if (Files.isDirectory(cacheDir) && Files.exists(marker)) {
            try {
                String tag = Files.readString(marker).trim();
                if (expectedTag.equals(tag)) {
                    return findAvatarRoot(cacheDir);
                }
            } catch (Exception ignored) {}
        }

        deleteTree(cacheDir);
        Files.createDirectories(cacheDir);

        try {
            if (lower.endsWith(".rar") || isRarFile(archive)) {
                extractRar(archive, cacheDir);
            } else {
                extractZip(archive, cacheDir);
            }
            Files.writeString(marker, expectedTag);
            return findAvatarRoot(cacheDir);
        } catch (IOException | RuntimeException ex) {
            deleteTree(cacheDir);
            throw ex;
        }
    }

    private static boolean isRarFile(Path archive) {
        try {
            return Unrar5j.detectFormat(archive.toAbsolutePath().toString()) != Unrar5j.FORMAT_UNKNOWN;
        } catch (Throwable t) {
            return false;
        }
    }

    private static void extractZip(Path zip, Path target) throws IOException {
        try (ZipFile zf = new ZipFile(zip.toFile())) {
            List<? extends ZipEntry> entries = zf.stream().filter(e -> !e.isDirectory()).toList();
            if (entries.isEmpty()) throw new IOException("The zip is empty");
            if (entries.size() > MAX_ENTRIES) throw new IOException("The zip has too many files");
            for (ZipEntry e : entries) {
                String n = e.getName();
                if (n.startsWith("/") || n.contains("\\") || n.contains(":") || n.contains("..")) {
                    throw new IOException("Unsafe path in the zip: " + n);
                }
            }
            List<String> names = entries.stream().map(ZipEntry::getName).toList();
            String prefix = commonFolder(names);

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
        }
    }

    private static void extractRar(Path rar, Path target) throws IOException {
        String rarPath = rar.toAbsolutePath().toString();
        try {
            if (Unrar5j.isEncrypted(rarPath)) throw new IOException("Encrypted RAR archives are not supported");
        } catch (IOException ex) {
            throw ex;
        } catch (Throwable t) {
            // ignore and proceed
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
        } finally {
            deleteTree(tempDir);
        }
    }

    private static Path findAvatarRoot(Path dir) {
        if (Files.exists(dir.resolve("avatar.json"))) return dir;
        try (Stream<Path> s = Files.list(dir)) {
            List<Path> list = s.filter(p -> !p.getFileName().toString().startsWith(".")).toList();
            if (list.size() == 1 && Files.isDirectory(list.get(0))) {
                return list.get(0);
            }
        } catch (Exception ignored) {}
        return dir;
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

    private static void deleteTree(Path root) {
        if (root == null || !Files.exists(root)) return;
        try (Stream<Path> s = Files.walk(root)) {
            s.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        } catch (IOException ignored) {}
    }
}
