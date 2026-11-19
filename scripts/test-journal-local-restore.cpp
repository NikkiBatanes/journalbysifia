// Host-only, synthetic data. The staged object uses the existing test fixture key.
#include "../native/journal-archive/LocalSnapshotCheck.hpp"
#include "../native/journal-archive/SyntheticFilePhoto.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>

namespace js = journal_snapshot;
namespace fs = std::filesystem;

std::string contents(const fs::path &path) {
  std::ifstream stream(path, std::ios::binary);
  js::check(stream.is_open());
  return {std::istreambuf_iterator<char>(stream), {}};
}

int main(int argc, char **argv) {
  try {
    js::check(argc == 4 && sodium_init() >= 0);
    const std::string mode = argv[1], root = argv[2], arg = argv[3];
    const fs::path dir = root;
    if (mode == "reopen") {
      js::check(journal_attachment::generatedName(arg, "photo-"));
      const auto sealed = contents(dir / arg);
      std::cout << journal_fixture::openAuthenticatedFrame({sealed.begin(), sealed.end()}, journal_fixture::password);
      return 0;
    }
    const auto archive = (dir / "archive").string();
    if (mode == "save") {
      const auto sources = js::sourcesFrom(contents(dir / "sources"), "file://" + root + "/");
      js::saveDocument(archive.c_str(), arg, contents(dir / "manifest"), sources, root.c_str(), "");
      return 0;
    }
    js::check(mode == "stage");
    const auto objects = dir / "objects";
    js::check(mkdir(objects.c_str(), 0700) == 0);
    try {
      std::string photo, list = "[";
      const auto evidence = js::readDocument(archive.c_str(), arg,
        [&](const unsigned char *data, size_t size) {
          js::check(photo.size() + size <= 8 * 1024 * 1024); // Fixture-only memory cap.
          photo.append(reinterpret_cast<const char *>(data), size);
        },
        [&](long long length, const std::string &digest) {
          const auto file = journal_photo_fixture::stageImage(objects.string(), photo, journal_photo_fixture::Interruption::none);
          if (list.size() > 1) list += ",";
          list += "{\"file\":\"" + file + "\",\"byteLength\":" + std::to_string(length) + ",\"sha256\":\"" + digest + "\"}";
          photo.clear();
        });
      std::cout << list << "]\n" << evidence;
    } catch (...) {
      fs::remove_all(objects); // Created exclusively by this attempt.
      throw;
    }
    return 0;
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
