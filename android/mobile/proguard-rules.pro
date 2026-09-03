# kotlinx.serialization（minify を有効にしたときのため）
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class jp.tcta.cns.container.shared.** {
    *** Companion;
}
-keepclasseswithmembers class jp.tcta.cns.container.shared.** {
    kotlinx.serialization.KSerializer serializer(...);
}
