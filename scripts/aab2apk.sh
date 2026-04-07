#!/bin/bash

# Ensure script stops on errors
set -e

if [ -z "$1" ]; then
  echo "Usage: ./aab2apk.sh <path_to_aab_file>"
  exit 1
fi

AAB_FILE="$1"

if [ ! -f "$AAB_FILE" ]; then
  echo "Error: File '$AAB_FILE' not found."
  exit 1
fi

BASENAME=$(basename "$AAB_FILE" .aab)
APKS_FILE="${BASENAME}.apks"
UNIVERSAL_APK="universal.apk"
FINAL_APK="${BASENAME}.apk"

# Set absolute paths to tools and local files
BUNDLETOOL="/home/boris/tracker/bundletool-all-1.15.6.jar"
APKSIGNER="/opt/android-sdk/build-tools/37.0.0/apksigner"
KEYSTORE="/home/boris/tracker/debug.keystore"
KEYSTORE_PASS="android"
KEY_PASS="android"

if [ ! -f "$BUNDLETOOL" ]; then
  echo "Downloading bundletool..."
  wget -nc -O "$BUNDLETOOL" https://github.com/google/bundletool/releases/download/1.15.6/bundletool-all-1.15.6.jar
fi

if [ ! -f "$KEYSTORE" ]; then
  echo "Generating debug keystore..."
  keytool -genkey -v -keystore "$KEYSTORE" -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -storepass "$KEYSTORE_PASS" -keypass "$KEY_PASS" -dname "CN=Android Debug,O=Android,C=US"
fi

echo "Building APKS from $AAB_FILE..."
# Remove existing APKS if it is already there to avoid bundletool error
rm -f "$APKS_FILE"
java -jar "$BUNDLETOOL" build-apks --bundle="$AAB_FILE" --output="$APKS_FILE" --mode=universal

echo "Extracting universal APK..."
unzip -o "$APKS_FILE" "$UNIVERSAL_APK"

echo "Signing APK..."
$APKSIGNER sign --ks "$KEYSTORE" --ks-pass pass:"$KEYSTORE_PASS" --key-pass pass:"$KEY_PASS" "$UNIVERSAL_APK"

echo "Renaming to $FINAL_APK..."
mv "$UNIVERSAL_APK" "$FINAL_APK"

echo "Cleaning up..."
rm "$APKS_FILE"

echo "✅ Success! Signed APK is ready at: $FINAL_APK"
