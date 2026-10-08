package dev.custommodskin.runtime.net;

import dev.custommodskin.runtime.client.ClientNet;
import dev.custommodskin.runtime.server.ServerSkins;
import dev.custommodskin.runtime.server.ZoneTracker;
import net.minecraft.core.BlockPos;
import net.minecraft.network.FriendlyByteBuf;

import java.util.UUID;

/** Every packet of the mod and where it is handled. C2S packets are capped at 32 KiB by vanilla, so uploads are chunked. */
public final class Messages {
    public static final int UPLOAD_CHUNK = 30_000;
    public static final int DOWNLOAD_CHUNK = 500_000;

    private Messages() {}

    /** client -> server: one part of the sender own skin PNG. kind 0 = main skin, 1 = talking (mouth-open) skin. */
    public record Upload(int index, int total, boolean slim, int kind, byte[] data) implements Msg {
        public void write(FriendlyByteBuf b) { b.writeVarInt(index); b.writeVarInt(total); b.writeBoolean(slim); b.writeVarInt(kind); b.writeByteArray(data); }
        static Upload read(FriendlyByteBuf b) { return new Upload(b.readVarInt(), b.readVarInt(), b.readBoolean(), b.readVarInt(), b.readByteArray(UPLOAD_CHUNK + 16)); }
    }

    /** client -> server: please send me the PNG with this hash. */
    public record Request(String hash) implements Msg {
        public void write(FriendlyByteBuf b) { b.writeUtf(hash, 64); }
        static Request read(FriendlyByteBuf b) { return new Request(b.readUtf(64)); }
    }

    /** server -> client: this player now uses skin {@code hash} (and optionally a talking skin). Empty hash = normal skin. */
    public record Announce(UUID player, String hash, boolean slim, String openHash) implements Msg {
        public void write(FriendlyByteBuf b) { b.writeUUID(player); b.writeUtf(hash, 64); b.writeBoolean(slim); b.writeUtf(openHash, 64); }
        static Announce read(FriendlyByteBuf b) { return new Announce(b.readUUID(), b.readUtf(64), b.readBoolean(), b.readUtf(64)); }
    }

    /** server -> client: one part of a requested PNG. */
    public record Download(String hash, int index, int total, byte[] data) implements Msg {
        public void write(FriendlyByteBuf b) { b.writeUtf(hash, 64); b.writeVarInt(index); b.writeVarInt(total); b.writeByteArray(data); }
        static Download read(FriendlyByteBuf b) { return new Download(b.readUtf(64), b.readVarInt(), b.readVarInt(), b.readByteArray(DOWNLOAD_CHUNK + 16)); }
    }

    /** client -> server: a creative player resized a zone block. */
    public record ZoneConfig(BlockPos pos, int width, int length, int height) implements Msg {
        public void write(FriendlyByteBuf b) { b.writeBlockPos(pos); b.writeVarInt(width); b.writeVarInt(length); b.writeVarInt(height); }
        static ZoneConfig read(FriendlyByteBuf b) { return new ZoneConfig(b.readBlockPos(), b.readVarInt(), b.readVarInt(), b.readVarInt()); }
    }

    /** server -> client: whether the player stands inside a skin zone. */
    public record ZoneState(boolean inside) implements Msg {
        public void write(FriendlyByteBuf b) { b.writeBoolean(inside); }
        static ZoneState read(FriendlyByteBuf b) { return new ZoneState(b.readBoolean()); }
    }

    /** client -> server: stop using a custom skin. */
    public record Reset() implements Msg {
        public void write(FriendlyByteBuf b) {}
        static Reset read(FriendlyByteBuf b) { return new Reset(); }
    }

    /** client -> server: the sender started / stopped talking (Plasmo Voice). */
    public record Speak(boolean speaking) implements Msg {
        public void write(FriendlyByteBuf b) { b.writeBoolean(speaking); }
        static Speak read(FriendlyByteBuf b) { return new Speak(b.readBoolean()); }
    }

    /** server -> client: a player started / stopped talking. */
    public record SpeakState(UUID player, boolean speaking) implements Msg {
        public void write(FriendlyByteBuf b) { b.writeUUID(player); b.writeBoolean(speaking); }
        static SpeakState read(FriendlyByteBuf b) { return new SpeakState(b.readUUID(), b.readBoolean()); }
    }

    /** Called by every loader on both sides, so packet ids match. Client handlers are only loaded when they run. */
    public static void register(Net net) {
        net.c2s("upload", Upload.class, Upload::read, ServerSkins::onUpload);
        net.c2s("request", Request.class, Request::read, ServerSkins::onRequest);
        net.c2s("reset", Reset.class, Reset::read, ServerSkins::onReset);
        net.c2s("speak", Speak.class, Speak::read, ServerSkins::onSpeak);
        net.c2s("zone_config", ZoneConfig.class, ZoneConfig::read, ZoneTracker::onConfig);
        net.s2c("announce", Announce.class, Announce::read, m -> ClientNet.onAnnounce(m));
        net.s2c("download", Download.class, Download::read, m -> ClientNet.onDownload(m));
        net.s2c("speak_state", SpeakState.class, SpeakState::read, m -> ClientNet.onSpeakState(m));
        net.s2c("zone_state", ZoneState.class, ZoneState::read, m -> ClientNet.onZoneState(m));
    }
}
