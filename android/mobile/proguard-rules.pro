# kotlinx.serialization（minify を有効にしたときのため）
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class jp.tcta.cns.container.shared.** {
    *** Companion;
}
-keepclasseswithmembers class jp.tcta.cns.container.shared.** {
    kotlinx.serialization.KSerializer serializer(...);
}
# WebView の JavaScript 橋渡し（@JavascriptInterface のメソッド名を保つ）
-keepclassmembers class jp.tcta.cns.container.mobile.bridge.** {
    @android.webkit.JavascriptInterface <methods>;
}
