/** RFQ NDA rules and the Skrappily standard template. Pure so it can be unit tested. */

export type NdaMode = "none" | "template" | "custom";
export const NDA_MODES: NdaMode[] = ["template", "custom", "none"];
export const DEFAULT_NDA_MODE: NdaMode = "template";
export const NDA_MODE_LABELS: Record<NdaMode, string> = {
  none: "No NDA",
  template: "Skrappily standard NDA",
  custom: "Buyer's own NDA",
};
export const NDA_TEMPLATE_VERSION = "skrappily-nda-v1";

export function parseNdaMode(value: string | null | undefined): NdaMode | null {
  return value === "none" || value === "template" || value === "custom" ? value : null;
}

export type NdaParties = {
  buyerName: string;
  quoterName: string;
  rfqTitle: string;
  rfqId: string;
  /** Effective date, e.g. "October 23, 2026". */
  date: string;
};

export const NDA_DISCLAIMER =
  "This is a general template provided for convenience. It is not legal advice, and Skrappily is not a party to it. Each business should have its own counsel review it before relying on it.";

export function ndaTemplateText(p: NdaParties): string {
  return `MUTUAL NON-DISCLOSURE AGREEMENT (RFQ)

Effective date: ${p.date}
RFQ: "${p.rfqTitle}" (Skrappily RFQ ${p.rfqId})

This Non-Disclosure Agreement ("Agreement") is between ${p.buyerName} ("Buyer"), the business that posted the RFQ above, and ${p.quoterName} ("Supplier"), the business reviewing the RFQ in order to quote it. Buyer and Supplier are each a "Party."

1. Purpose. Buyer is sharing drawings, models, specifications, and related information so Supplier can evaluate the RFQ, prepare a quote, and, if awarded, perform the work (the "Purpose").

2. Confidential Information. "Confidential Information" means all non-public information a Party discloses in connection with the RFQ, in any form, including drawings, CAD files, specifications, tolerances, processes, quantities, pricing, customer names, and the fact of the RFQ itself. Information Buyer attaches to the RFQ on Skrappily is Confidential Information whether or not it is marked.

3. Obligations. The receiving Party will (a) use Confidential Information only for the Purpose; (b) not disclose it to anyone except its employees and contractors who need to know it for the Purpose and are bound by confidentiality duties at least as protective as these; (c) protect it with at least reasonable care; (d) not reverse engineer, copy, or make parts from it except to perform an awarded order; and (e) promptly notify the disclosing Party of any unauthorized use or disclosure.

4. Exclusions. Obligations do not apply to information that the receiving Party can show (a) is or becomes public through no fault of its own; (b) it already knew without restriction; (c) it rightfully received from a third party without restriction; or (d) it developed independently without using the Confidential Information. A Party may disclose information when required by law or court order, after giving reasonable notice where allowed.

5. Export control. Supplier will comply with applicable export-control laws (including ITAR and EAR) for any controlled technical data it receives and will not export or share it with foreign persons without authorization.

6. Return or destruction. On request, or if Supplier does not quote or is not awarded the work, Supplier will delete or return Buyer's Confidential Information, except copies kept in routine backups or required by law, which remain subject to this Agreement.

7. No license or obligation. All Confidential Information stays the property of the disclosing Party. Nothing here grants any license or obliges either Party to award, accept, or perform any order.

8. Term. This Agreement covers disclosures made for this RFQ, and the confidentiality obligations last three (3) years from the last disclosure, or for as long as information remains a trade secret, if longer.

9. Remedies. Unauthorized disclosure may cause irreparable harm, and the disclosing Party may seek injunctive relief in addition to any other remedy.

10. General. This Agreement is the Parties' entire agreement on its subject and may be changed only in writing. It is governed by the laws of the state of Buyer's principal place of business. Electronic acceptance through Skrappily, including typed name and title, is a valid signature.

Signed electronically on Skrappily by the Supplier's authorized representative, on behalf of ${p.quoterName}. Buyer agrees to the same terms by posting the RFQ with this NDA.`;
}

export type NdaGateRfq = { ownerId: string; ndaMode: NdaMode; ndaRevision: number };

/** True when this viewer has to sign (or re-sign) the RFQ's current NDA. */
export function needsNdaSignature(
  rfq: NdaGateRfq,
  viewerId: string,
  signedRevisions: readonly number[],
): boolean {
  if (rfq.ndaMode === "none" || viewerId === rfq.ownerId) return false;
  return !signedRevisions.includes(rfq.ndaRevision);
}

export type GateFile = { quoteId: string | null; uploaderId: string; kind: string };

/**
 * Who may download an RFQ file:
 * - the NDA PDF itself: any signed-in business (they need to read it to sign);
 * - quote files: the quoter and the RFQ owner;
 * - RFQ drawings: everyone when there's no NDA, otherwise the owner and
 *   businesses that signed the current NDA revision.
 */
export function canAccessFile(
  file: GateFile,
  viewerId: string,
  rfq: NdaGateRfq,
  signedRevisions: readonly number[],
): boolean {
  if (file.kind === "nda") return true;
  if (file.quoteId) return viewerId === file.uploaderId || viewerId === rfq.ownerId;
  return !needsNdaSignature(rfq, viewerId, signedRevisions);
}

export type SignatureInput = { signerName: string; signerTitle: string; agree: boolean };

export function parseSignature(values: {
  signerName?: string;
  signerTitle?: string;
  agree?: string | null;
}): { ok: true; value: SignatureInput } | { ok: false; errors: Record<string, string> } {
  const signerName = (values.signerName ?? "").trim().replace(/\s+/g, " ");
  const signerTitle = (values.signerTitle ?? "").trim().replace(/\s+/g, " ");
  const errors: Record<string, string> = {};
  if (signerName.length < 3 || !signerName.includes(" ")) errors.signerName = "Type your full legal name (first and last).";
  else if (signerName.length > 120) errors.signerName = "Keep your name under 120 characters.";
  if (signerTitle.length < 2) errors.signerTitle = "Enter your title, like Owner or Purchasing Manager.";
  else if (signerTitle.length > 80) errors.signerTitle = "Keep your title under 80 characters.";
  if (values.agree !== "on") errors.agree = "Check the box to agree on behalf of your business.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { signerName, signerTitle, agree: true } };
}

export function formatNdaDate(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(new Date(ms));
}
