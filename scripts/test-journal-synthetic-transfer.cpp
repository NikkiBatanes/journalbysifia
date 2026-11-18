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
  fixture::require(first.find(fixture::manifest(token)) != std::string::npos);

  std::ifstream stream(received, std::ios::binary);
  fixture::Bytes bytes{std::istreambuf_iterator<char>(stream), {}};
  fixture::require(std::search(bytes.begin(), bytes.end(), token.begin(), token.end()) == bytes.end());
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

int main() {
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
