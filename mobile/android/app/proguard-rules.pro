# ── Flutter ────────────────────────────────────────────────────────────────
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-keep class io.flutter.embedding.** { *; }

# ── Firebase ───────────────────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class com.google.firebase.messaging.** { *; }

# ── Firebase App Check / Crashlytics (si se agrega en el futuro) ───────────
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── mobile_scanner / ML Kit ───────────────────────────────────────────────
-keep class com.google.mlkit.** { *; }

# ── Kotlin metadata ────────────────────────────────────────────────────────
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keepattributes Signature
-keepattributes Exceptions

# ── Google Play Core (Flutter lo referencia internamente, no lo usamos) ────
-dontwarn com.google.android.play.core.**
-keep class com.google.android.play.core.** { *; }

# ── Evitar warnings de dependencias transitivas ────────────────────────────
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
