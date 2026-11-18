// Build against the same libsodium used by the mobile diagnostic.
#include "../native/journal-archive/SyntheticTransfer.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>

namespace fixture = journal_fixture;

template <typename F> void expectRejection(F operation) {
  try {
    operation();
  } catch (const std::runtime_error &) {
    return;
  }
  throw std::logic_error("Invalid fixture was accepted");
}

void checkTransfer(const std::filesystem::path &root) {
  auto source = root / "source";
  auto destination = root / "destination";
  std::filesystem::create_directory(source);
  std::filesystem::create_directory(destination);
  auto token = fixture::exportFixture(source.string());
  auto filename = "journal-transfer-test.bin";
  auto received = destination / filename;
  std::filesystem::copy_file(source / filename, received);
  std::filesystem::remove_all(source);
  auto first = fixture::importFixture(destination.string());
  fixture::require(first.find(fixture::manifest(token, true)) != std::string::npos);

  std::ifstream stream(received, std::ios::binary);
  fixture::Bytes bytes{std::istreambuf_iterator<char>(stream), {}};
  fixture::require(std::search(bytes.begin(), bytes.end(), token.begin(), token.end()) == bytes.end());
  const auto photoManifest = fixture::manifest(token, true);
  const auto photoBytes = std::string(reinterpret_cast<const char *>(fixture::photo), sizeof(fixture::photo));
  fixture::require(fixture::decrypt(bytes, fixture::password) == photoManifest + photoBytes);
  // These files authenticate successfully but their attachment is missing or corrupted.
  expectRejection([&] { fixture::decrypt(fixture::encrypt(photoManifest), fixture::password); });
  auto wrongPhoto = photoBytes;
  wrongPhoto.back() ^= 1;
  expectRejection([&] { fixture::decrypt(fixture::encrypt(photoManifest + wrongPhoto), fixture::password); });
  auto oldText = fixture::manifest(token);
  fixture::require(fixture::decrypt(fixture::encrypt(oldText), fixture::password) == oldText);
  expectRejection([&] { fixture::decrypt(bytes, "incorrect"); });
  auto damaged = bytes;
  damaged.back() ^= 1;
  expectRejection([&] { fixture::decrypt(damaged, fixture::password); });
  std::ofstream(received, std::ios::binary | std::ios::app).put('x');
  expectRejection([&] { fixture::importFixture(destination.string()); });
  std::filesystem::resize_file(received, bytes.size()-1);
  expectRejection([&] { fixture::importFixture(destination.string()); });
  fixture::require(fixture::exportFixture(destination.string()) != token);
  auto linkTarget = destination / "renamed";
  std::filesystem::rename(received, linkTarget);
  expectRejection([&] { fixture::importFixture(destination.string()); });
  std::filesystem::create_symlink(linkTarget, received);
  expectRejection([&] { fixture::importFixture(destination.string()); });
}

// Integration tests use these files to exercise the mobile restore planner
// and executor with bytes that have passed through the actual native importer.
void writeSamples(const std::filesystem::path &root) {
  fixture::require(sodium_init() >= 0);
  const auto directory = root / "valid";
  fixture::require(std::filesystem::create_directory(directory));
  const auto token = fixture::exportFixture(directory.string());
  const auto manifest = fixture::manifest(token, true);
  auto damaged = std::string(reinterpret_cast<const char *>(fixture::photo), sizeof(fixture::photo));
  damaged.back() ^= 1;
  auto write = [&](const char *name, const std::string &plain) {
    const auto dir = root / name;
    fixture::require(std::filesystem::create_directory(dir));
    const auto bytes = fixture::encrypt(plain);
    std::ofstream out(dir / "journal-transfer-test.bin", std::ios::binary);
    out.write(reinterpret_cast<const char *>(bytes.data()), bytes.size());
    out.close();
    fixture::require(out.good());
  };
  write("missing", manifest);
  write("damaged", manifest + damaged);
  write("text", fixture::manifest(token));
  std::cout << token << '\n';
}

int main(int argc, char **argv) {
  if (argc != 1) {
    try {
      fixture::require(argc == 3);
      const std::string command = argv[1];
      if (command == "--samples") writeSamples(argv[2]);
      else if (command == "--read") std::cout << fixture::importFixture(argv[2]) << '\n';
      else return 2;
      return 0;
    } catch (const std::exception &e) {
      std::cerr << e.what() << '\n';
      return 1;
    }
  }
  std::string temp = (std::filesystem::temp_directory_path() / "journal-transfer-XXXXXX").string();
  if (!mkdtemp(temp.data())) return 1;
  try {
    checkTransfer(temp);
    std::filesystem::remove_all(temp);
    std::cout << "Portable fixture and invalid archive checks passed\n";
  } catch (const std::exception &e) {
    std::filesystem::remove_all(temp);
    std::cerr << e.what() << '\n';
    return 1;
  }
}
