// Build against the same libsodium used by the mobile diagnostic.
#include "../native/journal-archive/SyntheticTransfer.hpp"
#include "../native/journal-archive/SyntheticSharedTransfer.hpp"
#include <csignal>
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

void checkSampleDocument(const std::filesystem::path &root) {
  auto target = root / "picker-test";
  std::filesystem::create_directory(target);
  auto file = (root / "Sample Backup.bin").string();
  const auto code = fixture::freshToken();
  const auto wrong = fixture::freshToken();
  namespace transfer = journal_shared_transfer;
  const auto token = transfer::sampleDocument(file, code.c_str(), true);
  auto &previews = transfer::samplePreviews();
  auto preview = [&] {
    const auto result = transfer::sampleDocument(file, code.c_str(), false);
    const std::string prefix = R"({"previewId":")";
    fixture::require(result.compare(0, prefix.size(), prefix) == 0);
    fixture::require(result.find(R"(","entries":2,"photos":2,"photoBytes":)") == prefix.size() + 32);
    fixture::require(result.find(R"("firstContent":"Call Mom.")") != std::string::npos);
    return result.substr(prefix.size(), 32);
  };
  expectRejection([&] { transfer::sampleDocument(file, wrong.c_str(), false); });
  expectRejection([&] { transfer::sampleDocument(file, "1234", false); });
  expectRejection([&] { transfer::importFromFile(target.string(), file, fixture::password); });
  const auto cancelled = preview();
  previews.finish(target.string(), cancelled, "", false);
  expectRejection([&] { previews.finish(target.string(), cancelled, code.c_str(), true); });
  const auto stale = preview();
  const auto current = preview();
  previews.finish(target.string(), stale, "", false);
  expectRejection([&] { previews.finish(target.string(), stale, code.c_str(), true); });
  expectRejection([&] { previews.finish(target.string(), current, wrong.c_str(), true); });
  const auto selected = preview();
  fixture::require(std::filesystem::is_empty(target));
  std::filesystem::remove(file);
  const auto opened = previews.finish(target.string(), selected, code.c_str(), true);
  fixture::require(opened.find(token) != std::string::npos);
  expectRejection([&] { previews.finish(target.string(), selected, code.c_str(), true); });
}

void checkSharedPhotoCleanup(const std::filesystem::path &root) {
  namespace photos = journal_photo_fixture;
  const auto base = photos::sharedBase(root.string());
  const std::filesystem::path dir = photos::directory(base);
  const auto shared = photos::stage(base, false);
  const auto other = photos::stage(base, true);
  const auto unused = photos::stage(base, true);

  // If any referenced file has the wrong contents, preserve even the orphan.
  expectRejection([&] { photos::verifySharedPhotos(root.string(), other, other); });
  fixture::require(std::filesystem::exists(dir / shared) && std::filesystem::exists(dir / unused));

  photos::verifySharedPhotos(root.string(), shared, other);
  fixture::require(!std::filesystem::exists(dir / unused));
  photos::verifySharedPhotos(root.string(), "", other);
  photos::verifySharedPhotos(root.string(), "", other);
  fixture::require(!std::filesystem::exists(dir / shared) && std::filesystem::exists(dir / other));
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
      const std::string command = argv[1];
      if (command == "--export-shared" || command == "--read-shared") {
        fixture::require(argc == 3);
        std::cout << (command == "--export-shared" ? journal_shared_transfer::exportArchive(argv[2])
                                                  : journal_shared_transfer::importArchive(argv[2])) << '\n';
        return 0;
      }
      if (command == "--verify-pair") {
        fixture::require(argc == 7);
        journal_shared_transfer::verifyPair(argv[2], argv[3], argv[4], argv[5], argv[6]);
        return 0;
      }
      if (command == "--collect-photo") {
        fixture::require(argc == 4);
        journal_attachment::collect(argv[2], {argv[3]});
        return 0;
      }
      if (command == "--stage-photo") {
        fixture::require(argc == 7);
        std::array<unsigned char, crypto_hash_sha256_BYTES> digest{};
        const std::string hex = argv[5];
        fixture::require(hex.size() == digest.size() * 2 &&
          sodium_hex2bin(digest.data(), digest.size(), hex.data(), hex.size(), nullptr, nullptr, nullptr) == 0);
        const std::string stop = argv[6];
        const size_t length = std::stoul(argv[4]);
        const auto name = journal_attachment::stage(argv[2], argv[3], length, digest, [&](size_t count) {
          if (stop == "halfway" && count >= length / 2) std::raise(SIGKILL);
        });
        if (stop == "published") std::raise(SIGKILL);
        std::cout << name << '\n';
        return 0;
      }
      if (command == "--seal-photo" || command == "--open-photo") {
        fixture::require(argc == 2 && sodium_init() >= 0);
        const size_t limit = command == "--seal-photo" ? 16 * 1024 * 1024 - fixture::overhead : 16 * 1024 * 1024;
        std::string input;
        char chunk[64 * 1024];
        while (std::cin.read(chunk, sizeof(chunk)) || std::cin.gcount()) {
          input.append(chunk, static_cast<size_t>(std::cin.gcount()));
          fixture::require(input.size() <= limit);
        }
        fixture::require(std::cin.eof());
        if (command == "--seal-photo") {
          const auto bytes = fixture::encrypt(input);
          std::cout.write(reinterpret_cast<const char *>(bytes.data()), bytes.size());
        } else {
          const auto bytes = fixture::openAuthenticatedFrame({input.begin(), input.end()}, fixture::password);
          std::cout.write(bytes.data(), bytes.size());
        }
        return 0;
      }
      fixture::require(argc == 3);
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
    checkSharedPhotoCleanup(temp);
    checkSampleDocument(temp);
    std::filesystem::remove_all(temp);
    std::cout << "Portable fixture, invalid archive and shared photo cleanup checks passed\n";
  } catch (const std::exception &e) {
    std::filesystem::remove_all(temp);
    std::cerr << e.what() << '\n';
    return 1;
  }
}
