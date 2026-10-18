import { afterEach, describe, expect, it } from "vitest";
import { clientIp, readLimitedForm } from "@/lib/server/request";
import { readCookie } from "@/lib/auth/session";
import { rateLimit, rateLimitBucketCount, resetRateLimits } from "@/lib/server/rate-limit";

const req = (headers: Record<string, string>) => new Request("http://x.test/", { headers });

afterEach(() => {
  delete process.env.TRUSTED_PROXY_HOPS;
  resetRateLimits();
});

describe("client IP for rate limiting", () => {
  it("uses the address our proxy appended, not one the client made up", () => {
    // The client sent "1.1.1.1"; Railway's proxy appended the real address.
    expect(clientIp(req({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
    process.env.TRUSTED_PROXY_HOPS = "2"; // CDN in front of the platform proxy
    expect(clientIp(req({ "x-forwarded-for": "1.1.1.1, 198.51.100.7, 10.0.0.2" }))).toBe("198.51.100.7");
    process.env.TRUSTED_PROXY_HOPS = "0"; // directly exposed: forwarding headers are ignored
    expect(clientIp(req({ "x-forwarded-for": "1.1.1.1" }))).toBe("local");
  });

  it("rotating a spoofed X-Forwarded-For value no longer escapes the limit", () => {
    const hit = (fake: string) => rateLimit(`login:${clientIp(req({ "x-forwarded-for": `${fake}, 203.0.113.9` }))}`, 3, 60_000);
    hit("a");
    hit("b");
    hit("c");
    expect(() => hit("d")).toThrow();
  });
});

describe("rate limiter memory", () => {
  it("forgets keys once their window has passed", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 499; i++) rateLimit(`k${i}`, 5, 1000, t0);
    expect(rateLimitBucketCount()).toBe(499);
    rateLimit("later", 5, 1000, t0 + 5000); // 500th call triggers a sweep
    expect(rateLimitBucketCount()).toBe(1);
  });
});

describe("upload size limits", () => {
  const form = (bytes: number) => {
    const fd = new FormData();
    fd.set("pose", "front");
    fd.set("file", new Blob([new Uint8Array(bytes)]), "a.jpg");
    return new Request("http://x.test/", { method: "POST", body: fd });
  };

  it("refuses a declared size over the limit before reading anything", async () => {
    const r = new Request("http://x.test/", { method: "POST", headers: { "content-length": String(100 * 1024 * 1024), "content-type": "multipart/form-data; boundary=x" }, body: "x" });
    await expect(readLimitedForm(r, 1024)).rejects.toMatchObject({ status: 413 });
  });

  it("stops reading a stream without a length once it passes the limit", async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        pulled++;
        c.enqueue(new Uint8Array(64 * 1024));
        if (pulled > 1000) c.close();
      },
    });
    const r = new Request("http://x.test/", { method: "POST", body: stream, headers: { "content-type": "multipart/form-data; boundary=x" }, duplex: "half" } as RequestInit);
    await expect(readLimitedForm(r, 256 * 1024)).rejects.toMatchObject({ status: 413 });
    expect(pulled).toBeLessThan(10);
  });

  it("parses uploads within the limit", async () => {
    const fd = await readLimitedForm(form(10_000), 1024 * 1024);
    expect(fd!.get("pose")).toBe("front");
    expect((fd!.get("file") as Blob).size).toBe(10_000);
  });
});

describe("cookies", () => {
  it("treats a malformed cookie as missing instead of failing the request", () => {
    expect(readCookie("apex_session=%E0%A4%A; other=1", "apex_session")).toBeUndefined();
    expect(readCookie("a=1; apex_session=abc%3D", "apex_session")).toBe("abc=");
  });
});
