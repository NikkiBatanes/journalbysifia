#include "../native/journal-archive/PickerPhoto.hpp"
#include <cassert>
#include <filesystem>
#include <fstream>
#include <cstdlib>

int main(int argc, char **argv) {
  auto pattern = ((argc > 1 ? std::filesystem::path(argv[1]) : std::filesystem::temp_directory_path()) / "journal-picker-photo-XXXXXX").string();
  const char *dir = mkdtemp(pattern.data());
  assert(dir);
  for (std::string prefix : {"", "rn_image_picker_lib_temp_"}) {
    std::string stem = prefix + "51EBC779-2F01-45CA-AC72-906F4EA014A0";
    auto jpg = stem + ".jpg", png = stem + ".png";
    auto path = std::filesystem::path(dir) / jpg;
    auto check = [&](std::string name, long long budget = 100000) {
      return journal_picker::inspect(dir, name, prefix, budget);
    };
    assert(check(jpg) == journal_picker::missing);
    std::string bytes = std::string("\xff\xd8\xff", 3) + std::string(70000, 'a');
    std::ofstream(path, std::ios::binary).write(bytes.data(), bytes.size());
    assert(check(jpg) == static_cast<long long>(bytes.size()));
    assert(check(jpg, bytes.size()-1) == journal_picker::tooLarge);
    assert(check("../" + jpg) == journal_picker::unsupported);
    assert(check(stem + ".heic") == journal_picker::unsupported);
    // Replace the directory entry while the original file descriptor is open.
    bool replaced = false;
    auto result = journal_picker::capture(dir, jpg, prefix, bytes.size(), [&](const unsigned char *, size_t) {
      if (replaced) return;
      replaced = true;
      auto replacement = path.string() + ".replacement";
      std::ofstream(replacement, std::ios::binary).write(bytes.data(), bytes.size());
      std::filesystem::rename(replacement, path);
    });
    assert(replaced && result == journal_picker::unreadable);
    auto pngPath = std::filesystem::path(dir) / png;
    std::filesystem::create_symlink(path, pngPath);
    assert(check(png) == journal_picker::unreadable);
    std::filesystem::remove(pngPath);
    std::filesystem::rename(path, pngPath);
    assert(check(png) == journal_picker::unsupported);
    std::ofstream(pngPath, std::ios::binary) << "\x89PNG\r\n\x1a\nbody";
    assert(check(png) == 12);
    std::filesystem::remove(pngPath);
  }
  std::filesystem::remove(dir);
}
