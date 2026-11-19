#!/usr/bin/env bash
# Run from macOS Terminal.app only. This script deliberately refuses non-interactive use.
set -euo pipefail
umask 077

marker='leave-browser-1792757422-67396'
expected_jdbc_url='jdbc:postgresql://localhost:5432/cms_leave_test'
expected_role='cms_leave_test'
frontend_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
backend_dir="$(cd -- "$frontend_dir/../class-management-system" && pwd)"
manifest_dir="$backend_dir/.leave-browser-manifests"
manifest="$manifest_dir/$marker.manifest"
pgpass_file="${PGPASSFILE:-$HOME/.cms-leave-test.pgpass}"
backend_pid=''
helper_dir=''

die() {
  echo "leave-browser-e2e: $*" >&2
  exit 1
}

cleanup() {
  local status=$?
  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill -INT "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  fi
  [[ -z "$helper_dir" ]] || rm -rf -- "$helper_dir"
  unset test_password test_password_confirmation database_password
  exit "$status"
}
trap cleanup EXIT INT TERM

[[ -t 0 && -t 1 && -r /dev/tty && -w /dev/tty ]] || die 'an interactive Terminal.app session is required.'
[[ -z "${DB_URL:-}" && -z "${DATABASE_URL:-}" && -z "${SPRING_DATASOURCE_URL:-}" ]] || die 'development datasource overrides must be unset.'
[[ -n "${JWT_SECRET:-}" ]] || die 'JWT_SECRET must be set in this Terminal session.'
[[ -r "$manifest" && -r "$pgpass_file" ]] || die 'the marker manifest and private PostgreSQL credential file must be readable.'
[[ "$(stat -f '%Lp' "$manifest_dir" 2>/dev/null || true)" == '700' ]] || die 'manifest directory must be owner-only (0700).'
[[ "$(stat -f '%Lp' "$manifest" 2>/dev/null || true)" == '600' ]] || die 'manifest must be owner-only (0600).'

for port in 18080 14200; do
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && die "isolated port $port is occupied."
done

printf 'New disposable Leave browser-test password: ' >/dev/tty
IFS= read -r -s test_password </dev/tty
printf '\nConfirm disposable password: ' >/dev/tty
IFS= read -r -s test_password_confirmation </dev/tty
printf '\n' >/dev/tty
[[ -n "$test_password" && "$test_password" == "$test_password_confirmation" ]] || die 'password confirmation failed.'
unset test_password_confirmation

database_password="$(/usr/bin/perl - "$pgpass_file" <<'PERL'
use strict;
use warnings;
my $path = shift;
open my $fh, '<', $path or die "credential file unavailable\n";
sub fields {
  my ($line) = @_;
  my (@fields, $value, $escaped);
  for my $char (split //, $line) {
    if ($escaped) { $value .= $char; $escaped = 0; next; }
    if ($char eq '\\') { $escaped = 1; next; }
    if ($char eq ':') { push @fields, $value; $value = ''; next; }
    $value .= $char;
  }
  push @fields, $value;
  return @fields;
}
while (my $line = <$fh>) {
  chomp $line;
  next if $line =~ /^\s*(?:#|$)/;
  my @field = fields($line);
  next unless @field == 5
      && $field[0] eq 'localhost'
      && $field[1] eq '5432'
      && $field[2] eq 'cms_leave_test'
      && $field[3] eq 'cms_leave_test';
  print $field[4];
  exit 0;
}
die "cms_leave_test credential entry unavailable\n";
PERL
)"
[[ -n "$database_password" ]] || die 'cms_leave_test credential entry is empty.'

helper_dir="$(mktemp -d /private/tmp/leave-browser-rotation.XXXXXX)"
chmod 700 "$helper_dir"
helper_source="$helper_dir/RotateLeaveBrowserPassword.java"

cat >"$helper_source" <<'JAVA'
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public final class RotateLeaveBrowserPassword {
  private static final String MARKER = required("LEAVE_BROWSER_RUN_MARKER");
  private static final Path MANIFEST = Path.of(required("LEAVE_BROWSER_MANIFEST_FILE"));
  private static final String URL = "jdbc:postgresql://localhost:5432/cms_leave_test";
  private static final String ROLE = "cms_leave_test";

  record User(long id, String email, String role) {}

  public static void main(String[] args) throws Exception {
    String password = required("LEAVE_BROWSER_TEST_PASSWORD");
    try {
      List<User> users = readUsers();
      String hash = new BCryptPasswordEncoder().encode(password);
      if (!new BCryptPasswordEncoder().matches(password, hash)) throw new IllegalStateException("BCrypt validation failed");
      rotate(users, hash);
    } finally {
      password = null;
    }
  }

  private static List<User> readUsers() throws IOException {
    Map<Long, User> users = new LinkedHashMap<>();
    boolean runHeader = false;
    for (String line : Files.readAllLines(MANIFEST)) {
      String[] parts = line.split("\\|", -1);
      if (parts.length == 3 && parts[0].equals("v1") && parts[1].equals("run") && parts[2].equals(MARKER)) runHeader = true;
      if (!parts[0].equals("user")) continue;
      if (parts.length != 5 || !parts[2].equals(MARKER)) throw new IllegalStateException("invalid manifest user entry");
      long id = Long.parseLong(parts[1]);
      if (id < 1 || users.putIfAbsent(id, new User(id, parts[3], parts[4])) != null) throw new IllegalStateException("duplicate manifest user ID");
    }
    if (!runHeader || users.size() != 6) throw new IllegalStateException("manifest does not contain exactly six run users");
    Map<String, String> expected = Map.of(
        MARKER + "-admin@test.invalid", "ADMIN",
        MARKER + "-teacher@test.invalid", "TEACHER",
        MARKER + "-restricted-teacher@test.invalid", "TEACHER",
        MARKER + "-student@test.invalid", "STUDENT",
        MARKER + "-other-student@test.invalid", "STUDENT",
        MARKER + "-tenant-b-owner@test.invalid", "ADMIN");
    if (!users.values().stream().allMatch(user -> expected.get(user.email()) != null && expected.get(user.email()).equals(user.role()))) {
      throw new IllegalStateException("manifest user identities are not the expected marker-owned accounts");
    }
    return List.copyOf(users.values());
  }

  private static void rotate(List<User> users, String hash) throws Exception {
    try (Connection connection = DriverManager.getConnection(URL, ROLE, required("LEAVE_BROWSER_TEST_DB_PASSWORD"))) {
      connection.setAutoCommit(false);
      try {
        verifyIdentity(connection);
        Map<Long, User> expected = new LinkedHashMap<>();
        for (User user : users) expected.put(user.id(), user);
        String placeholders = String.join(",", java.util.Collections.nCopies(users.size(), "?"));
        try (PreparedStatement select = connection.prepareStatement("SELECT id, email, role FROM users WHERE id IN (" + placeholders + ") FOR UPDATE")) {
          for (int index = 0; index < users.size(); index++) select.setLong(index + 1, users.get(index).id());
          try (ResultSet rows = select.executeQuery()) {
            int matches = 0;
            while (rows.next()) {
              User actual = expected.remove(rows.getLong("id"));
              if (actual == null || !actual.email().equals(rows.getString("email")) || !actual.role().equals(rows.getString("role"))) {
                throw new IllegalStateException("database user does not match its manifest-owned identity");
              }
              matches++;
            }
            if (matches != 6 || !expected.isEmpty()) throw new IllegalStateException("database does not contain exactly the six manifest-owned users");
          }
        }
        try (PreparedStatement update = connection.prepareStatement("UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (" + placeholders + ")")) {
          update.setString(1, hash);
          for (int index = 0; index < users.size(); index++) update.setLong(index + 2, users.get(index).id());
          if (update.executeUpdate() != 6) throw new IllegalStateException("password update did not affect exactly six users");
        }
        try (PreparedStatement revoke = connection.prepareStatement("UPDATE auth_sessions SET revoked = true WHERE revoked = false AND user_id IN (" + placeholders + ")")) {
          for (int index = 0; index < users.size(); index++) revoke.setLong(index + 1, users.get(index).id());
          revoke.executeUpdate();
        }
        connection.commit();
        System.out.println("CREDENTIAL_ROTATION_COMMITTED users=6");
      } catch (Exception failure) {
        connection.rollback();
        throw failure;
      }
    }
  }

  private static void verifyIdentity(Connection connection) throws Exception {
    try (PreparedStatement statement = connection.prepareStatement("SELECT current_database(), current_user, inet_server_port(), inet_server_addr(), inet_client_addr()"); ResultSet row = statement.executeQuery()) {
      if (!row.next()
          || !"cms_leave_test".equals(row.getString(1))
          || !ROLE.equals(row.getString(2))
          || row.getInt(3) != 5432
          || !loopback(row.getString(4))
          || !loopback(row.getString(5))) throw new IllegalStateException("unexpected PostgreSQL identity");
    }
  }

  private static boolean loopback(String address) {
    return Set.of("127.0.0.1", "127.0.0.1/32", "::1", "::1/128", "0:0:0:0:0:0:0:1").contains(address);
  }

  private static String required(String name) {
    String value = System.getenv(name);
    if (value == null || value.isBlank()) throw new IllegalStateException(name + " is required");
    return value;
  }
}
JAVA

crypto_jar="$HOME/.m2/repository/org/springframework/security/spring-security-crypto/7.0.5/spring-security-crypto-7.0.5.jar"
spring_core_jar="$HOME/.m2/repository/org/springframework/spring-core/7.0.8/spring-core-7.0.8.jar"
logging_jar="$HOME/.m2/repository/commons-logging/commons-logging/1.3.5/commons-logging-1.3.5.jar"
postgres_jar="$HOME/.m2/repository/org/postgresql/postgresql/42.7.11/postgresql-42.7.11.jar"
[[ -r "$crypto_jar" && -r "$spring_core_jar" && -r "$logging_jar" && -r "$postgres_jar" ]] || die 'required project-resolved BCrypt/JDBC dependencies are unavailable; no rotation occurred.'
javac -cp "$crypto_jar:$spring_core_jar:$logging_jar:$postgres_jar" -d "$helper_dir" "$helper_source"

LEAVE_BROWSER_RUN_MARKER="$marker" \
LEAVE_BROWSER_MANIFEST_FILE="$manifest" \
LEAVE_BROWSER_TEST_PASSWORD="$test_password" \
LEAVE_BROWSER_TEST_DB_PASSWORD="$database_password" \
java -cp "$helper_dir:$crypto_jar:$spring_core_jar:$logging_jar:$postgres_jar" RotateLeaveBrowserPassword

backend_log="$(mktemp /private/tmp/leave-browser-backend.XXXXXX.log)"
chmod 600 "$backend_log"
(
  cd "$backend_dir"
  env -u DB_URL -u DATABASE_URL -u SPRING_DATASOURCE_URL \
    TEST_DB_USERNAME="$expected_role" TEST_DB_PASSWORD="$database_password" JWT_SECRET="$JWT_SECRET" \
    bash scripts/run-leave-browser-backend.sh
) >"$backend_log" 2>&1 &
backend_pid=$!

for _ in $(seq 1 90); do
  identity="$(curl --silent --show-error --fail --max-time 2 http://localhost:18080/api/v1/browser-test/identity 2>/dev/null || true)"
  if [[ "$identity" == *'"database":"cms_leave_test"'* && "$identity" == *'"port":5432'* && ( "$identity" == *'"address":"127.0.0.1"'* || "$identity" == *'"address":"::1"'* ) ]]; then
    break
  fi
  kill -0 "$backend_pid" 2>/dev/null || die "isolated backend exited before readiness; inspect $backend_log"
  sleep 1
  [[ "$_" -lt 90 ]] || die "isolated backend did not verify cms_leave_test identity; inspect $backend_log"
done

cd "$frontend_dir"
env -u DB_URL -u DATABASE_URL -u SPRING_DATASOURCE_URL -u LEAVE_BROWSER_CLEANUP_AFTER_TESTS \
  LEAVE_BROWSER_DB_URL="$expected_jdbc_url" \
  LEAVE_BROWSER_RUN_MARKER="$marker" \
  LEAVE_BROWSER_MANIFEST_DIR="$manifest_dir" \
  LEAVE_BROWSER_MANIFEST_FILE="$manifest" \
  LEAVE_BROWSER_FIXTURE_SCRIPT="$backend_dir/scripts/leave-browser-fixtures.sh" \
  PGPASSFILE="$pgpass_file" \
  LEAVE_BROWSER_ADMIN_EMAIL="$marker-admin@test.invalid" \
  LEAVE_BROWSER_TEACHER_EMAIL="$marker-teacher@test.invalid" \
  LEAVE_BROWSER_RESTRICTED_TEACHER_EMAIL="$marker-restricted-teacher@test.invalid" \
  LEAVE_BROWSER_STUDENT_EMAIL="$marker-student@test.invalid" \
  LEAVE_BROWSER_OTHER_STUDENT_EMAIL="$marker-other-student@test.invalid" \
  LEAVE_BROWSER_TEST_PASSWORD="$test_password" \
  npm run e2e:leave
