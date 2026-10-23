import { describe, expect, it, vi } from "vitest";
import { validateGmailSender, validateImapMailbox, canQueueHumanMail } from "./mailbox-safety";

describe("WEG inbound Gmail scope", () => {
  for (const bad of ["", "INBOX", "All Mail", "[Gmail]/All Mail",
    "[Gmail]/Sent Mail", "[Gmail]/Spam", "*"]) {
    it("refuses wide Gmail scope " + JSON.stringify(bad), () => {
      expect(() => validateImapMailbox("imap.gmail.com", bad, "owner@gmail.com")).toThrow();
    });
  }
  it("allows only explicit Gmail label", () => {
    expect(() => validateImapMailbox("imap.gmail.com", "WEG-HomeManager", "owner@gmail.com")).not.toThrow();
  });
  it("does not alter non-Gmail IMAP servers", () => {
    expect(() => validateImapMailbox("mail.mycompany.de", "INBOX", "mail@mycompany.de")).not.toThrow();
  });
});

describe("Gmail sender belongs to authenticated account", () => {
  it("permits user selected plus alias", () => {
    expect(() => validateGmailSender("smtp.gmail.com", "owner@gmail.com", "owner+weg@gmail.com")).not.toThrow();
  });
  it("permits primary Gmail sender", () => {
    expect(() => validateGmailSender("smtp.gmail.com", "owner@gmail.com", "owner@gmail.com")).not.toThrow();
  });
  it("refuses unrelated Gmail sender", () => {
    expect(() => validateGmailSender("smtp.gmail.com", "owner@gmail.com", "someoneelse@gmail.com")).toThrow();
  });
  it("does not restrict other SMTP providers", () => {
    expect(() => validateGmailSender("smtp.mycompany.de", "user", "different@example.de")).not.toThrow();
  });
});

vi.mock("server-only", () => ({}));
import { sendMail } from "./adapters/mailer";

describe("outbound SMTP fail-closed safety", () => {
  it("never marks unconfigured SMTP as successful", async () => {
    await expect(sendMail({
      to: "synthetic@example.invalid", subject: "Synthetic", body: "Nothing is sent",
    }, { host: "", user: "", password: "", from: "" })).rejects.toThrow("Kein SMTP");
  });
});

describe("manual outbound approval gate", () => {
  it("keeps new mail as draft without checked confirmation", () => {
    expect(canQueueHumanMail("", null)).toBe(false);
    expect(canQueueHumanMail("send", null)).toBe(false);
    expect(canQueueHumanMail("send", "no")).toBe(false);
  });
  it("draft action overrides even a previously checked confirmation", () => {
    expect(canQueueHumanMail("draft", "yes")).toBe(false);
  });
  it("requires explicit review acknowledgment to queue a new mail", () => {
    expect(canQueueHumanMail("send", "yes")).toBe(true);
  });
});
