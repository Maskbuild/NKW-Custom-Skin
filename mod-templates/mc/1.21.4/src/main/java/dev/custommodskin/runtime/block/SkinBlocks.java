package dev.custommodskin.runtime.block;

import com.mojang.serialization.MapCodec;
import dev.custommodskin.runtime.SkinConfig;
import dev.custommodskin.runtime.SkinMod;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.context.BlockPlaceContext;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.BaseEntityBlock;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.RenderShape;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.material.PushReaction;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.shapes.CollisionContext;
import net.minecraft.world.phys.shapes.Shapes;
import net.minecraft.world.phys.shapes.VoxelShape;

import java.util.function.Consumer;

/** The optional blocks: the skin station (opens the wardrobe) and the skin zone marker (creative only). */
public final class SkinBlocks {
    public static final ResourceLocation STATION_ID = SkinMod.id("skin_station");
    public static final ResourceLocation ZONE_ID = SkinMod.id("skin_zone");

    public static Block STATION;
    public static Block ZONE;
    public static Item STATION_ITEM;
    public static Item ZONE_ITEM;
    public static BlockEntityType<ZoneBlockEntity> ZONE_BE;

    /** Set by the client side; the common block code only calls these on the logical client. */
    public static Runnable openWardrobe = () -> {};
    public static Consumer<ZoneBlockEntity> openZoneEditor = be -> {};

    private static boolean created;

    private SkinBlocks() {}

    /**
     * Builds the blocks and items the mod needs; each loader then registers them under the ids above.
     * Call it from inside the loader block registration (Forge refuses new blocks once registries are frozen).
     */
    public static void create() {
        if (created) return;
        created = true;
        if (SkinConfig.blockEnabled()) {
            STATION = new StationBlock(BlockBehaviour.Properties.of().setId(ResourceKey.create(Registries.BLOCK, STATION_ID)).strength(2.0f).sound(SoundType.WOOD));
            STATION_ITEM = new BlockItem(STATION, new Item.Properties().setId(ResourceKey.create(Registries.ITEM, STATION_ID)).useBlockDescriptionPrefix());
        }
        if (SkinConfig.zoneEnabled()) {
            // like the barrier: unbreakable by hand, creative players can still break it
            ZONE = new ZoneBlock(BlockBehaviour.Properties.of().setId(ResourceKey.create(Registries.BLOCK, ZONE_ID)).strength(-1.0f, 3600000.0f).noLootTable().noCollission().noOcclusion().pushReaction(PushReaction.BLOCK));
            ZONE_ITEM = new ZoneItem(ZONE, new Item.Properties().setId(ResourceKey.create(Registries.ITEM, ZONE_ID)).useBlockDescriptionPrefix());
            ZONE_BE = SkinMod.platform.blockEntityType(ZoneBlockEntity::new, ZONE);
        }
    }

    static final class StationBlock extends Block {
        StationBlock(Properties properties) { super(properties); }

        @Override
        protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos, Player player, BlockHitResult hit) {
            if (level.isClientSide) openWardrobe.run();
            return InteractionResult.SUCCESS;
        }
    }

    static final class ZoneItem extends BlockItem {
        ZoneItem(Block block, Properties properties) { super(block, properties); }

        @Override
        protected boolean canPlace(BlockPlaceContext ctx, BlockState state) {
            Player p = ctx.getPlayer();
            return p != null && p.isCreative() && super.canPlace(ctx, state);
        }
    }

    static final class ZoneBlock extends BaseEntityBlock {
        private static final MapCodec<ZoneBlock> CODEC = simpleCodec(ZoneBlock::new);

        ZoneBlock(Properties properties) { super(properties); }

        @Override
        protected MapCodec<? extends BaseEntityBlock> codec() { return CODEC; }

        @Override
        public BlockEntity newBlockEntity(BlockPos pos, BlockState state) { return new ZoneBlockEntity(pos, state); }

        @Override
        protected RenderShape getRenderShape(BlockState state) { return RenderShape.INVISIBLE; }

        @Override
        protected VoxelShape getShape(BlockState state, BlockGetter level, BlockPos pos, CollisionContext ctx) {
            // like the light block: it cannot be targeted (or even seen) unless you hold the item
            return ZONE_ITEM != null && ctx.isHoldingItem(ZONE_ITEM) ? Shapes.block() : Shapes.empty();
        }

        @Override
        protected VoxelShape getCollisionShape(BlockState state, BlockGetter level, BlockPos pos, CollisionContext ctx) { return Shapes.empty(); }

        @Override
        protected boolean propagatesSkylightDown(BlockState state) { return true; }

        @Override
        protected float getShadeBrightness(BlockState state, BlockGetter level, BlockPos pos) { return 1.0f; }

        @Override
        protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos, Player player, BlockHitResult hit) {
            if (!player.isCreative()) return InteractionResult.PASS;
            if (level.isClientSide && level.getBlockEntity(pos) instanceof ZoneBlockEntity be) openZoneEditor.accept(be);
            return InteractionResult.SUCCESS;
        }
    }
}
