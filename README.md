# NKW Custom Skin

A node-based launcher that builds a **Minecraft Java mod with HD skin support** (128 – 2048 px, vanilla only reads
64×64). Connect nodes, press **Test** to try the mod in game, or **Export** a `.jar`.

- Skin wardrobe (key, block or zone), up to a limit you set or unlimited, visible to everyone on a server
- Preset skins shipped inside the mod
- Skin zones: a creative-only block that marks an area where players can change skin (you see it as a green block while holding it)
- Skin blocks: right-click a game block (a crafting table, a mod block …) or a block of your own to open the wardrobe; a message shows while you look at it
- Optional **Figura** avatar per outfit (a folder or a `.zip`, shown with the Figura logo) and **Plasmo Voice** talking skin (neither is required). Figura models that use the player skin get the HD skin too
- Browse blocks, items, models and textures of Minecraft and of any mod, and import them into your project

## Download

Get the zip from the [Releases](https://github.com/Maskbuild/NKW-Custom-Skin/releases) page, unzip it anywhere and run
`NKW Custom Skin.exe` (Windows 64-bit). There is no installer.

You also need **Java**: JDK 21 for Minecraft 1.21.x, JDK 17 for 1.20.1 (a newer JDK also works). Git is optional
(the project history panel uses it). The first build downloads Minecraft and Gradle, so it needs internet.

## Targets

| Minecraft | Fabric | Forge | Java |
| --------- | :----: | :---: | :--: |
| 1.20.1    |   ✓    |   ✓   |  17  |
| 1.21.1    |   ✓    |   ✓   |  21  |
| 1.21.4    |   ✓    |   ✓   |  21  |

A test run can add Mod Menu (Fabric only), Figura and Plasmo Voice (Plasmo Voice has no Forge 1.21.4 build). They are
downloaded from Modrinth for the test only and never packed into your jar.

## In game

Press **K** (rebindable) to open the wardrobe, drop a PNG on the window or use *Add skin*, press *Apply*. A small
notice in the top right says the skin was applied. *Reset to my Minecraft skin* goes back to the normal skin. When
the mod has skin zones, the key only works inside a zone.

## Game items and mods

*Game items* (left bar) lists the blocks, items, models and textures of Minecraft (downloaded once from Mojang and
checked with their checksum, you are asked first) and of mods you add (a `.jar` file or *Mod browser… → Add to
project*, from Modrinth). Blocks are drawn like the game draws them. Drag a block or item onto the canvas to get a **Block / item** node (its textures
are copied into the project), or select entries and import them into `textures/` and `models/`.

In the wardrobe node, switch on *Skin changing block* to get a **Blocks** pin and connect Block / item nodes to it: a game
block opens the wardrobe when right-clicked, or tick *make my own block* to add a new block built from the textures.
With a skin block the key stops working (like with zones, where it only works inside a zone).

## Build from source

Needs Node.js 22+ and JDK 21 (and 17 for 1.20.1 targets).

```bash
cd launcher
npm install
npm run dev          # run the app
npm test             # unit tests
npm run dist         # portable zip in launcher/dist
npm run verify:targets   # builds a sample mod for all six targets with real Gradle and boots a headless server
```

```
launcher/                 the app (Electron + React)
mod-templates/
  shared/resources/       assets used by every target
  mc/<version>/src/       game code shared by Fabric and Forge of that Minecraft version (Mojang mappings)
  targets/<loader>-<mc>/  build files + the thin loader layer (entry points, packets, registration)
```

The exporter merges `shared` < `mc/<version>` < `targets/<loader>-<mc>` into a Gradle project, writes the mod id, name,
version, the runtime config (from the nodes) and the preset skins, and runs `gradlew`.

## Status

`verify:targets` builds all six targets and boots a dedicated server with each mod. Client-side code (the wardrobe
screen, the skin mixin, Figura and Plasmo Voice hooks) compiles for every target but has only been tried in a
running game on Fabric 1.21.1. Please test and report problems.

Minecraft is a trademark of Mojang Studios / Microsoft. This is not an official Minecraft product.
