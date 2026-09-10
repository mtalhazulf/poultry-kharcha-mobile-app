# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# --- react-native-config -----------------------------------------------------
# Reads BuildConfig (in the namespace package) by reflection.
-keep class com.mps.expensetracker.BuildConfig { *; }

# --- @react-native-google-signin/google-signin (Google Play Services) --------
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# --- react-native-image-picker ----------------------------------------------
-keep class com.imagepicker.** { *; }

# --- Supabase (supabase-js talks HTTP through RN's OkHttp networking) --------
-dontwarn okhttp3.**
-dontwarn okio.**
