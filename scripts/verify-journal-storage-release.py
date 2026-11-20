"""Inspect the SQLCipher provider in Journal's device archive or Play bundle on macOS."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import subprocess
import tempfile
from zipfile import ZipFile

PROVIDER = b"OpenSSL 3.5.9 29 Sep 2026"
BASELINE_PROVIDER = b"OpenSSL 3.6.2 7 Apr 2026"
ABI_MACHINES = {
    "armeabi-v7a": "ARM",
    "arm64-v8a": "AArch64",
    "x86": "Intel 80386",
    "x86_64": "Advanced Micro Devices X86-64",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def output(*args):
    return subprocess.check_output(args, text=True)


def verify_android(bundle):
    sdk = Path(os.environ.get("ANDROID_HOME", Path.home() / "Library/Android/sdk"))
    readelf = sdk / "ndk/27.1.12297006/toolchains/llvm/prebuilt/darwin-x86_64/bin/llvm-readelf"
    expected = {f"base/lib/{abi}/libop-sqlite.so" for abi in ABI_MACHINES}
    result = {}
    with ZipFile(bundle) as archive, tempfile.TemporaryDirectory() as scratch:
        names = archive.namelist()
        require(sorted(n for n in names if n.endswith("/libop-sqlite.so")) == sorted(expected),
                "Expected exactly one OP-SQLite library per supported Android architecture")
        require(not any(n.endswith(("/libcrypto.so", "/libssl.so")) for n in names),
                "Unexpected standalone OpenSSL library in Play bundle")
        require(archive.getinfo("base/assets/index.android.bundle").file_size > 0,
                "Journal JavaScript bundle missing")
        for abi, machine in ABI_MACHINES.items():
            data = archive.read(f"base/lib/{abi}/libop-sqlite.so")
            require(PROVIDER in data and BASELINE_PROVIDER not in data and b"cipher_provider_version" in data,
                    f"{abi}: expected SQLCipher and OpenSSL markers")
            binary = Path(scratch) / "libop-sqlite.so"
            binary.write_bytes(data)
            info = output(readelf, "-h", "-d", "-lW", binary).splitlines()
            require(any(line.strip().startswith("Machine:") and line.split(":", 1)[1].strip() == machine
                        for line in info), f"{abi}: incorrect ELF machine")
            require(not any("NEEDED" in line and ("libcrypto.so" in line or "libssl.so" in line)
                            for line in info), f"{abi}: dynamically linked OpenSSL")
            alignments = [int(line.split()[-1], 16) for line in info if line.lstrip().startswith("LOAD ")]
            require(alignments and min(alignments) >= 16384, f"{abi}: unsupported ELF page alignment")
            result[abi] = {"sha256": hashlib.sha256(data).hexdigest(), "min_load_alignment": min(alignments)}
    return result


def verify_ios(archive):
    with (archive / "Info.plist").open("rb") as stream:
        app_path = plistlib.load(stream)["ApplicationProperties"]["ApplicationPath"]
    app = archive / "Products" / app_path
    with (app / "Info.plist").open("rb") as stream:
        info = plistlib.load(stream)
    require(info["CFBundleIdentifier"] == "app.journal.sifia", "Expected the Journal app")
    require("iPhoneOS" in info["CFBundleSupportedPlatforms"], "Expected an iOS device archive")
    require((app / "main.jsbundle").stat().st_size > 0, "Missing Journal JavaScript bundle")
    binary = app / info["CFBundleExecutable"]
    framework = app / "Frameworks/OpenSSL.framework/OpenSSL"
    ref = "@rpath/OpenSSL.framework/OpenSSL"
    require(ref in output("xcrun", "otool", "-L", binary), "Journal does not link the expected framework")
    require(ref in output("xcrun", "otool", "-D", framework), "Unexpected framework install name")
    for path in (binary, framework):
        require(output("xcrun", "lipo", "-archs", path).strip() == "arm64", f"{path.name}: expected arm64")
        metadata = output("xcrun", "vtool", "-show-build", path).split()
        require(metadata[metadata.index("platform") + 1] == "IOS", f"{path.name}: expected device platform")
    require(b"cipher_provider_version" in binary.read_bytes(), "SQLCipher missing from Journal executable")
    data = framework.read_bytes()
    require(PROVIDER in data and BASELINE_PROVIDER not in data,
            "Unexpected OpenSSL provider in embedded iPhone framework")
    return {"platform": "iOS arm64", "framework_sha256": hashlib.sha256(data).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ios-archive", type=Path)
    parser.add_argument("--android-bundle", type=Path)
    args = parser.parse_args()
    if not args.ios_archive and not args.android_bundle:
        parser.error("Supply an iPhone archive or Play bundle to inspect")
    result = {}
    if args.ios_archive:
        result["iphone"] = verify_ios(args.ios_archive)
    if args.android_bundle:
        result["android"] = verify_android(args.android_bundle)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
