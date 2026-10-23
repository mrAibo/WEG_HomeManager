/** Single-account Gmail scope: only an explicitly chosen user label is safe.
 * Access credentials still grant broader account access. This blocks accidental
 * application-side INBOX/All Mail import, not access at the Gmail OAuth layer.
 */
export function validateImapMailbox(
  host: string, mailbox: string, user: string,
): void {
  if (host.trim().toLowerCase() !== "imap.gmail.com") return;
  const label = mailbox.trim();
  const forbidden = /^(?:INBOX|ALL MAIL|\[Gmail\]\/All Mail|\[Google Mail\]\/All Mail|\[Gmail\]\/Sent Mail|\[Gmail\]\/Trash|\[Gmail\]\/Spam|\[Gmail\]\/Important|\*)$/i;
  if (!label || forbidden.test(label)) {
    throw new Error("Gmail: Nur ein ausdrücklich angelegtes WEG-Label als IMAP-Mailbox erlaubt, nicht INBOX/Alle Nachrichten.");
  }
  if (!user.toLowerCase().endsWith("@gmail.com")) {
    throw new Error("Gmail: IMAP-Konto muss mit dem tatsächlich angemeldeten Gmail-Konto übereinstimmen.");
  }
}

/** Refuse to forge another Gmail identity with an unrelated login. */
export function validateGmailSender(host: string, user: string, from: string): void {
  if (host.trim().toLowerCase() !== "smtp.gmail.com") return;
  if (!user.trim() || !from.trim()) throw new Error("Gmail: SMTP-Login und Absender erforderlich.");
  const account = user.trim().toLowerCase();
  const sender = from.trim().toLowerCase();
  if (sender.endsWith("@gmail.com") && account.endsWith("@gmail.com")) {
    const primary = account.slice(0, -"@gmail.com".length);
    const local = sender.slice(0, -"@gmail.com".length);
    if (!(local === primary || local.startsWith(primary + "+"))) {
      throw new Error("Gmail: Absender muss zum authentifizierten Gmail-Konto gehören.");
    }
  }
}

/** New outbound message is always a draft unless the human acknowledged review. */
export function canQueueHumanMail(intent: string | null, confirmation: string | null): boolean {
  return intent !== "draft" && confirmation === "yes";
}
