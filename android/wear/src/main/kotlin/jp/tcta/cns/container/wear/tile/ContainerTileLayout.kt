package jp.tcta.cns.container.wear.tile

import android.content.Context
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.DeviceParametersBuilders.DeviceParameters
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.DimensionBuilders.wrap
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.LayoutElementBuilders.LayoutElement
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.material3.MaterialScope
import androidx.wear.protolayout.material3.Typography
import androidx.wear.protolayout.material3.materialScope
import androidx.wear.protolayout.material3.primaryLayout
import androidx.wear.protolayout.material3.text
import androidx.wear.protolayout.material3.textEdgeButton
import androidx.wear.protolayout.types.layoutString
import jp.tcta.cns.container.shared.ContainerInfo
import jp.tcta.cns.container.shared.DataLayerContract
import jp.tcta.cns.container.shared.DisplayFormat
import jp.tcta.cns.container.wear.MainActivity
import jp.tcta.cns.container.wear.R
import jp.tcta.cns.container.wear.data.StoredSnapshot

/**
 * Tile のレイアウト（ProtoLayout Material 3）。
 *
 * 上: コンテナ名 / 中: 積載率・残容量・ステータス / 下: 「詳細」ボタン。
 * どこをタップしても詳細画面（[MainActivity] にコンテナ ID を渡す）が開く。
 */
object ContainerTileLayout {
    fun build(context: Context, device: DeviceParameters, snapshot: StoredSnapshot?): LayoutElement {
        val container = snapshot?.payload?.selectedContainer
        return materialScope(context = context, deviceConfiguration = device) {
            if (container == null) emptyLayout(context) else containerLayout(context, container)
        }
    }

    private fun MaterialScope.containerLayout(context: Context, container: ContainerInfo): LayoutElement {
        val open = openDetailClickable(context, container.id)
        // 例: "残 32% ・ 12PL 23CT"
        val subtitle = context.getString(R.string.label_remaining) + " " +
            DisplayFormat.percent(container.remainingPercentage) + " ・ " +
            DisplayFormat.palletCarton(container.totalPallets, container.totalCartons)
        return primaryLayout(
            onClick = open,
            titleSlot = {
                text(
                    text = container.name.layoutString,
                    typography = Typography.TITLE_SMALL,
                    maxLines = 1,
                )
            },
            mainSlot = {
                LayoutElementBuilders.Column.Builder()
                    .setWidth(expand())
                    .setHeight(wrap())
                    .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
                    .addContent(
                        text(
                            text = DisplayFormat.percent(container.loadPercentage).layoutString,
                            typography = Typography.NUMERAL_MEDIUM,
                            color = colorScheme.primary,
                            maxLines = 1,
                        ),
                    )
                    .addContent(
                        text(
                            text = subtitle.layoutString,
                            typography = Typography.BODY_SMALL,
                            color = colorScheme.onSurfaceVariant,
                            maxLines = 1,
                        ),
                    )
                    .addContent(
                        text(
                            text = container.status.layoutString,
                            typography = Typography.LABEL_MEDIUM,
                            color = colorScheme.tertiary,
                            maxLines = 1,
                        ),
                    )
                    .build()
            },
            bottomSlot = {
                textEdgeButton(onClick = open) {
                    text(text = context.getString(R.string.tile_detail).layoutString)
                }
            },
        )
    }

    private fun MaterialScope.emptyLayout(context: Context): LayoutElement {
        val open = openDetailClickable(context, containerId = null)
        return primaryLayout(
            onClick = open,
            titleSlot = {
                text(
                    text = context.getString(R.string.tile_label).layoutString,
                    typography = Typography.TITLE_SMALL,
                    maxLines = 1,
                )
            },
            mainSlot = {
                text(
                    text = context.getString(R.string.tile_no_data).layoutString,
                    typography = Typography.BODY_MEDIUM,
                    color = colorScheme.onSurfaceVariant,
                    maxLines = 3,
                )
            },
            bottomSlot = {
                textEdgeButton(onClick = open) {
                    text(text = context.getString(R.string.tile_open).layoutString)
                }
            },
        )
    }

    /** アプリ（詳細画面）を開く Clickable。ID が null なら一覧を開く */
    private fun openDetailClickable(context: Context, containerId: String?): ModifiersBuilders.Clickable {
        val activity = ActionBuilders.AndroidActivity.Builder()
            .setPackageName(context.packageName)
            .setClassName(MainActivity::class.java.name)
        if (containerId != null) {
            activity.addKeyToExtraMapping(
                DataLayerContract.EXTRA_CONTAINER_ID,
                ActionBuilders.AndroidStringExtra.Builder().setValue(containerId).build(),
            )
        }
        return ModifiersBuilders.Clickable.Builder()
            .setId(if (containerId == null) "open_app" else "open_detail")
            .setOnClick(
                ActionBuilders.LaunchAction.Builder()
                    .setAndroidActivity(activity.build())
                    .build(),
            )
            .build()
    }
}
