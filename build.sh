mkdir -p out
yarn tauri build

UNAME="$(uname -s)"
case "${UNAME}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    CYGWIN*)    MACHINE=Cygwin;;
    MINGW*)     MACHINE=MinGw;;
    *)          MACHINE="UNKNOWN:${UNAME}"
esac

if [[ "$MACHINE" == "Mac" ]]
then
    TARGET_DIR=src-tauri/target/release/bundle
    STASYS_DIR=$TARGET_DIR/macos/STASYS.app
    dylibbundler -od -b -x $STASYS_DIR/Contents/MacOS/STASYS -d $STASYS_DIR/Contents/libs
    $TARGET_DIR/dmg/bundle_dmg.sh --volname STASYS --icon STASYS 180 170 --app-drop-link 480 170 --window-size 660 400 --hide-extension STASYS.app out/STASYS.dmg src-tauri/target/release/bundle/macos
else
    TARGET_DIR=src-tauri/target/release/
    mkdir -p out/STASYS/
    cp $TARGET_DIR/STASYS.exe out/STASYS/
    cp "C:\\tools\\opencv\\build\\x64\\vc15\\bin\\opencv_world460.dll" out/STASYS/
    cp "$FFMPEG_DIR\\bin\\*.dll" out/STASYS/
    ls out/STASYS/
    powershell "Compress-Archive out/STASYS/ out/STASYS.zip"
fi