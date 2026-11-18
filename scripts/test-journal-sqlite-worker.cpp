// Build with OPWorkerThread.cpp and its include directory, using C++17.
#include "OPWorkerThread.hpp"
#include <atomic>
#include <future>
#include <thread>

int main() {
  opsqlite::WorkerThread worker;
  std::promise<bool> selfJoinRejected;
  worker.queue_work([&] {
    try {
      worker.shutdown();
      selfJoinRejected.set_value(false);
    } catch (const std::system_error &error) {
      selfJoinRejected.set_value(error.code() == std::errc::resource_deadlock_would_occur);
    }
  });
  if (!selfJoinRejected.get_future().get()) {
    return 1;
  }
  worker.shutdown();

  // Hermes can finalize a handle on a new thread that reused the worker's ID.
  std::atomic<bool> failed{false};
  for (int attempt = 0; attempt < 32; ++attempt) {
    std::thread finalizer([&] {
      try {
        worker.shutdown();
      } catch (const std::system_error &) {
        failed = true;
      }
    });
    finalizer.join();
  }
  return failed ? 2 : 0;
}
