cmake_minimum_required(VERSION 3.22.1)
project(appmodules LANGUAGES C CXX)

# Preserve React Native's New Architecture application target and generated
# module providers. The archive provider is an additional isolated library.
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

find_package(sodium REQUIRED CONFIG)

add_library(
  journal_archive_crypto
  SHARED
  ../cpp/journal_archive_crypto.cpp
  ../cpp/journal_archive_file_transport.cpp
  ../cpp/journal_archive_media_packaging.cpp
)

target_compile_features(journal_archive_crypto PRIVATE cxx_std_20)
target_compile_options(
  journal_archive_crypto
  PRIVATE
  -Wall
  -Wextra
  -Werror
  -fvisibility=hidden
)

target_link_libraries(journal_archive_crypto PRIVATE sodium::sodium z)
