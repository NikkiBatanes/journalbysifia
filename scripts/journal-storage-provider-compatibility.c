// Standalone device test. Run in a fresh, private test directory. The key and
// contents are public fixtures. This program never opens a Journal app container.
#include "sqlite3.h"
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static const char filename[] = "provider-compatibility-test.sqlite";
static const char fixture_key[] = "journal-provider-compatibility-test-only";

static void require(int condition, const char *message) {
  if (!condition) {
    fprintf(stderr, "Failed: %s\n", message);
    exit(EXIT_FAILURE);
  }
}

static sqlite3 *open_fixture(int flags, const char *key) {
  sqlite3 *db = NULL;
  require(sqlite3_open_v2(filename, &db, flags, NULL) == SQLITE_OK, "open fixture");
  require(sqlite3_key(db, key, (int)strlen(key)) == SQLITE_OK, "set fixture key");
  return db;
}

static void execute(sqlite3 *db, const char *sql) {
  require(sqlite3_exec(db, sql, NULL, NULL, NULL) == SQLITE_OK, "execute fixture statement");
}

static void expect_value(sqlite3 *db, const char *sql, const char *expected) {
  sqlite3_stmt *statement = NULL;
  require(sqlite3_prepare_v2(db, sql, -1, &statement, NULL) == SQLITE_OK, sql);
  require(sqlite3_step(statement) == SQLITE_ROW, sql);
  const unsigned char *value = sqlite3_column_text(statement, 0);
  require(value && strcmp((const char *)value, expected) == 0, sql);
  require(sqlite3_step(statement) == SQLITE_DONE, sql);
  require(sqlite3_finalize(statement) == SQLITE_OK, sql);
}

int main(int argc, char **argv) {
  require(argc == 4, "usage: probe create|update|reopen 'exact OpenSSL runtime version' test-directory");
  require(chdir(argv[3]) == 0, "enter test directory");
  const int create = strcmp(argv[1], "create") == 0;
  const int update = strcmp(argv[1], "update") == 0;
  require(create || update || strcmp(argv[1], "reopen") == 0, "unknown test mode");
  if (create) {
    int fd = open(filename, O_WRONLY | O_CREAT | O_EXCL, 0600);
    require(fd >= 0 && close(fd) == 0, "reserve new fixture");
  } else {
    sqlite3 *wrong = open_fixture(SQLITE_OPEN_READONLY, "deliberately-wrong-test-key");
    require(sqlite3_exec(wrong, "SELECT count(*) FROM sqlite_master", NULL, NULL, NULL)
            == SQLITE_NOTADB, "wrong key must reject encrypted database");
    require(sqlite3_close(wrong) == SQLITE_OK, "close wrong-key connection");
  }
  sqlite3 *db = open_fixture(create || update ? SQLITE_OPEN_READWRITE : SQLITE_OPEN_READONLY,
                             fixture_key);
  expect_value(db, "PRAGMA cipher_provider_version", argv[2]);
  expect_value(db, "PRAGMA cipher_version", "4.19.0 community");
  if (create) {
    execute(db, "CREATE TABLE fixture (id INTEGER PRIMARY KEY, caption TEXT NOT NULL);"
                "INSERT INTO fixture VALUES (1, 'original synthetic caption')");
  }
  if (update) {
    expect_value(db, "SELECT caption FROM fixture WHERE id=1", "original synthetic caption");
    execute(db, "BEGIN; UPDATE fixture SET caption='unfinished edit' WHERE id=1; ROLLBACK");
    expect_value(db, "SELECT caption FROM fixture WHERE id=1", "original synthetic caption");
    execute(db, "BEGIN; UPDATE fixture SET caption='saved synthetic caption' WHERE id=1; COMMIT");
  }
  expect_value(db, "SELECT caption FROM fixture", create ? "original synthetic caption" : "saved synthetic caption");
  expect_value(db, "PRAGMA integrity_check", "ok");
  require(sqlite3_close(db) == SQLITE_OK, "close fixture");
  printf("%s passed with %s\n", argv[1], argv[2]);
  return EXIT_SUCCESS;
}
