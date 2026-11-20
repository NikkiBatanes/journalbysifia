"""Build and inspect Journal's candidate mobile libcrypto archives on macOS."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

VERSION = "3.5.9"
DIGEST = "603f5602e2eef00d77fbd429d34dcd5822bb301757a1bc9cdb24c670f1eb859a"
NDK_VERSION = "27.1.12297006"
ANDROID = {
    "armeabi-v7a": ("android-arm", "armv7a-linux-androideabi", "ARM"),
    "arm64-v8a": ("android-arm64", "aarch64-linux-android", "AArch64"),
    "x86": ("android-x86", "i686-linux-android", "Intel 80386"),
    "x86_64": ("android-x86_64", "x86_64-linux-android", "Advanced Micro Devices X86-64"),
}
APPLE = {
    "ios-arm64": ("ios64-xcrun", "iphoneos", "arm64"),
    "ios-simulator-arm64": ("iossimulator-arm64-xcrun", "iphonesimulator", "arm64"),
    "ios-simulator-x86_64": ("iossimulator-x86_64-xcrun", "iphonesimulator", "x86_64"),
}


def output(command):
    return subprocess.check_output(command, text=True).strip()


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def build(name, source, build_dir, destination, ndk, jobs):
    tools = ndk / "toolchains/llvm/prebuilt/darwin-x86_64/bin"
    env = dict(os.environ, SOURCE_DATE_EPOCH="0", ZERO_AR_DATE="1", LC_ALL="C")
    if name in ANDROID:
        target, triple, machine = ANDROID[name]
        flags = ["-D__ANDROID_API__=24"]
        env.update(ANDROID_NDK_ROOT=str(ndk), PATH=f"{tools}:{env['PATH']}")
    else:
        target, sdk, arch = APPLE[name]
        simulator = sdk == "iphonesimulator"
        flags = ["-mios-simulator-version-min=15.1" if simulator else "-miphoneos-version-min=15.1"]

    build_dir.mkdir()

    def run(command):
        subprocess.run(command, cwd=build_dir, env=env, check=True)

    configure = os.path.relpath(source / "Configure", build_dir)
    run(["perl", configure, target, "no-shared", "no-module", "no-tests", *flags])
    for goal in ("build_generated", "libcrypto.a"):
        run(["make", f"-j{jobs}", goal])
    destination.mkdir()
    headers = destination / "include/openssl"
    headers.mkdir(parents=True)
    for folder in (source, build_dir):
        for header in (folder / "include/openssl").glob("*.h"):
            shutil.copyfile(header, headers / header.name)
    archive = destination / "libcrypto.a"
    shutil.copyfile(build_dir / "libcrypto.a", archive)
    # Link the complete archive to catch wrong-platform members and missing dependencies.
    probe = build_dir / "probe.c"
    probe.write_text(
        "#include <openssl/crypto.h>\n#include <openssl/opensslv.h>\n"
        "_Static_assert(OPENSSL_VERSION_MAJOR == 3 && OPENSSL_VERSION_MINOR == 5"
        " && OPENSSL_VERSION_PATCH == 9, \"unexpected headers\");\n"
        "const char *journal_provider_version(void) { return OpenSSL_version(OPENSSL_VERSION); }\n"
    )
    binary = build_dir / "linked"
    common = ["-I", str(headers.parent), str(probe), "-o", str(binary)]
    if name in ANDROID:
        run([tools / f"{triple}24-clang", "-shared", "-fPIC", *common,
             "-Wl,--whole-archive", archive, "-Wl,--no-whole-archive",
             "-Wl,-z,defs,-z,max-page-size=16384", "-ldl", "-lm", "-llog"])
        elf = output([tools / "llvm-readelf", "-h", "-lW", "-d", binary])
        machines = [line.split(":", 1)[1].strip() for line in elf.splitlines() if "Machine:" in line]
        alignment = [int(line.split()[-1], 16) for line in elf.splitlines() if line.lstrip().startswith("LOAD ")]
        if machines != [machine] or not alignment or min(alignment) < 16384 or "libcrypto.so" in elf:
            raise ValueError(f"Unexpected {name} link result: {elf}")
    else:
        triple = f"{arch}-apple-ios15.1" + ("-simulator" if simulator else "")
        run(["xcrun", "--sdk", sdk, "clang", "-target", triple, "-dynamiclib", *common,
             "-Xlinker", "-force_load", "-Xlinker", archive, "-framework", "Security"])
        metadata = output(["xcrun", "vtool", "-show-build", binary]).split()
        platform = "IOSSIMULATOR" if simulator else "IOS"
        if (output(["xcrun", "lipo", "-archs", binary]) != arch
                or metadata[metadata.index("platform") + 1] != platform
                or metadata[metadata.index("minos") + 1] != "15.1"):
            raise ValueError(f"Unexpected {name} link result: {metadata}")
    if b"OpenSSL 3.5.9 29 Sep 2026" not in binary.read_bytes():
        raise ValueError(f"Missing provider version in linked {name} binary")
    shutil.rmtree(build_dir)
    print(f"Verified {name}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tarball", type=Path)
    parser.add_argument("destination", type=Path, help="New directory, with an existing parent")
    parser.add_argument("--jobs", default=8, type=int)
    args = parser.parse_args()
    dest = args.destination.resolve()
    if dest.exists() or args.jobs < 1:
        parser.error("Use a new destination and a positive job count")
    sdk = Path(os.environ.get("ANDROID_HOME", Path.home() / "Library/Android/sdk"))
    ndk = sdk.resolve() / "ndk" / NDK_VERSION
    if f"Pkg.Revision = {NDK_VERSION}" not in (ndk / "source.properties").read_text():
        raise ValueError("Unexpected Android NDK revision")
    with tempfile.TemporaryDirectory(prefix=".journal-provider-", dir=dest.parent) as scratch:
        root = Path(scratch)
        with args.tarball.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != DIGEST:
                raise ValueError("OpenSSL source SHA-256 mismatch")
            stream.seek(0)
            with tarfile.open(fileobj=stream, mode="r:gz") as tar:
                tar.extractall(root, filter="data")
        source = root / f"openssl-{VERSION}"
        package = root / "package"
        package.mkdir()
        for name in (*APPLE, *ANDROID):
            build(name, source, root / "build", package / name, ndk, args.jobs)
        shutil.copyfile(source / "LICENSE.txt", package / "LICENSE.txt")
        manifest = {
            "openssl": VERSION, "source_sha256": DIGEST, "ndk": NDK_VERSION,
            "xcode": output(["xcodebuild", "-version"]),
            "sdk_builds": {sdk: output(["xcrun", "--sdk", sdk, "--show-sdk-build-version"])
                           for sdk in ("iphoneos", "iphonesimulator")},
            "sha256": {str(p.relative_to(package)): sha(p)
                       for p in sorted(package.rglob("*")) if p.is_file()},
        }
        (package / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        if dest.exists():
            raise FileExistsError(dest)
        package.rename(dest)


if __name__ == "__main__":
    main()
