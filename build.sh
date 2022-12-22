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
fi
