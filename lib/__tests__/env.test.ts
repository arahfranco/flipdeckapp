import { describe, it, expect, afterEach } from "vitest";
import { env, missingEnv } from "../env";

const KEY = "FLIPDECK_TEST_VAR";
afterEach(() => {
  delete process.env[KEY];
});

describe("env", () => {
  it("returns a plain value unchanged", () => {
    process.env[KEY] = "flipdeck";
    expect(env(KEY)).toBe("flipdeck");
  });

  // The actual production failure: values pasted into a hosting dashboard keep
  // the quotes from the .env line, and a quoted account id builds a hostname
  // the browser can't resolve.
  it("strips surrounding double quotes", () => {
    process.env[KEY] = '"da54527f4ac945e7d037d408a4e69301"';
    expect(env(KEY)).toBe("da54527f4ac945e7d037d408a4e69301");
  });

  it("strips surrounding single quotes", () => {
    process.env[KEY] = "'flipdeck'";
    expect(env(KEY)).toBe("flipdeck");
  });

  it("strips whitespace around quoted values", () => {
    process.env[KEY] = '  "flipdeck"  ';
    expect(env(KEY)).toBe("flipdeck");
  });

  it("leaves quotes that are part of the value itself", () => {
    process.env[KEY] = 'say "hi" now';
    expect(env(KEY)).toBe('say "hi" now');
  });

  it("returns empty string for an unset variable", () => {
    expect(env(KEY)).toBe("");
  });

  it("treats a value of only quotes as empty", () => {
    process.env[KEY] = '""';
    expect(env(KEY)).toBe("");
  });
});

describe("missingEnv", () => {
  it("reports unset variables", () => {
    expect(missingEnv([KEY])).toEqual([KEY]);
  });

  // A quoted-empty value is present but useless — it must count as missing, or
  // it passes the config check and fails later somewhere unrelated.
  it("counts a quoted-empty value as missing", () => {
    process.env[KEY] = '""';
    expect(missingEnv([KEY])).toEqual([KEY]);
  });

  it("accepts a quoted real value", () => {
    process.env[KEY] = '"flipdeck"';
    expect(missingEnv([KEY])).toEqual([]);
  });
});
