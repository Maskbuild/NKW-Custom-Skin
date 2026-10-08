package dev.custommodskin.runtime.client;

import dev.custommodskin.runtime.net.Messages;

/** Entry points for packets that arrive on the client. Kept apart so dedicated servers never load client classes. */
public final class ClientNet {
    private ClientNet() {}

    public static void onAnnounce(Messages.Announce m) { ClientSkins.onAnnounce(m); }

    public static void onDownload(Messages.Download m) { ClientSkins.onDownload(m); }

    public static void onSpeakState(Messages.SpeakState m) { ClientSkins.onSpeakState(m); }

    public static void onZoneState(Messages.ZoneState m) { ZoneClient.setInside(m.inside()); }
}
