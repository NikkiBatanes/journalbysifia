// Portable test fixtures only. Pass a private scratch directory for the photos.
#include "../native/journal-archive/LocalSnapshotCheck.hpp"
#include <fstream>
#include <iterator>
#include <iostream>

namespace js = journal_snapshot;
using File = std::unique_ptr<FILE, decltype(&fclose)>;
File openFile(const std::string &path, const char *mode) {
  File file(fopen(path.c_str(), mode), fclose);
  js::check(bool(file));
  return file;
}

template <typename Test> void expectFailure(Test test) {
  try { test(); } catch (const std::runtime_error &) { return; }
  throw std::runtime_error("Expected a rejected snapshot");
}

int main(int argc, char **argv) {
  try {
    js::check(argc == 4 && sodium_init() >= 0);
    const std::string mode = argv[1], dir = argv[2], archive = argv[3];
    const std::string code = "1234567890abcdef1234567890abcdef";
    const std::string manifest = u8R"({"entry":"Panalangin 🙏 café","photos":["objects/a","objects/b"]})";
    const std::string prefix =
#ifdef __ANDROID__
      "rn_image_picker_lib_temp_";
#else
      "";
#endif
    const std::string base = "file://" + dir + "/";
    const std::string leaf = prefix + "12345678-1234-1234-1234-123456789abc";
    std::string jpeg("\xff\xd8\xff", 3);
    jpeg += std::string(70000, 'A');
    const std::string png("\x89PNG\r\n\x1a\n", 8);
    const auto describe = [&](const std::string &name, const std::string &content) {
      js::Hash hash;
      hash.update(reinterpret_cast<const unsigned char *>(content.data()), content.size());
      return std::to_string(content.size()) + "\t" + hash.finish() + "\t" + base + name;
    };
    const auto rows = describe(leaf + ".jpg", jpeg) + "\n" + describe(leaf + ".png", png);
    const auto sources = js::sourcesFrom(rows, base);
    const auto read = [&](const std::string &password, const std::string &expected) {
      auto file = openFile(archive, "rb");
      js::verify(file.get(), password, expected, sources);
    };
    const auto inspect = [&] {
      auto decoded = js::inspectDocument(archive.c_str(), code);
      const auto end = decoded.find('\n');
      js::check(end != std::string::npos && decoded.substr(end + 1) == manifest);
      for (const auto &source : sources) {
        js::check(decoded.substr(0, end).find(source.hash) != std::string::npos);
      }
    };
    if (mode == "open") { inspect(); return 0; }
    if (mode == "read") {
      read(code, manifest);
      return 0;
    }
    js::check(mode == "write" || mode == "test");
    std::ofstream(dir + "/" + sources[0].name, std::ios::binary).write(jpeg.data(), jpeg.size());
    std::ofstream(dir + "/" + sources[1].name, std::ios::binary).write(png.data(), png.size());
    js::saveDocument(archive.c_str(), code, manifest, sources, dir.c_str(), prefix.c_str());
    read(code, manifest);
    inspect();
    expectFailure([&] { js::inspectDocument(archive.c_str(), std::string(32, 'f')); });
    if (mode == "write") return 0;
    js::roundTrip(dir.c_str(), prefix.c_str(), manifest, sources);
    js::roundTrip(dir.c_str(), prefix.c_str(), manifest, {});
    std::ifstream stream(archive, std::ios::binary);
    const std::string bytes(std::istreambuf_iterator<char>(stream), {});
    js::check(bytes.find(manifest) == std::string::npos && bytes.find(leaf) == std::string::npos &&
              bytes.find(std::string(32, 'A')) == std::string::npos);
    expectFailure([&] { read(std::string(32, 'f'), manifest); });
    expectFailure([&] { read(code, "{}"); });
    expectFailure([&] { js::sourcesFrom(rows, "file:///different/"); });
    auto corrupted = bytes;
    corrupted[corrupted.size()/2] ^= 1;
    for (const auto &invalid : {bytes + "!", bytes.substr(0, bytes.size()-1), corrupted}) {
      std::ofstream(archive, std::ios::binary).write(invalid.data(), invalid.size());
      expectFailure([&] { read(code, manifest); });
      expectFailure(inspect);
    }
    jpeg.back() = 'B';
    std::ofstream(dir + "/" + sources[0].name, std::ios::binary).write(jpeg.data(), jpeg.size());
    expectFailure([&] { js::roundTrip(dir.c_str(), prefix.c_str(), manifest, sources); });
    js::check(unlink((dir + "/" + sources[0].name).c_str()) == 0);
    expectFailure([&] { js::roundTrip(dir.c_str(), prefix.c_str(), manifest, sources); });
    std::cout << "Snapshot round trip and rejection checks passed\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
