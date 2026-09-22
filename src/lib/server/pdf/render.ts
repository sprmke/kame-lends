import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { LoansPDFDocument } from "./loans-pdf-document";
import { InvestorsPDFDocument } from "./investors-pdf-document";
import { TransactionsPDFDocument } from "./transactions-pdf-document";
import { LoanContractPDFDocument } from "./loan-contract-pdf-document";
import { formatDateForPDF } from "$lib/pdf-export";
import {
  buildLoanContractData,
  getLoanContractFilename,
  normalizeLoanContractData,
} from "$lib/loan-contract-data";
import type { ContractCustomization } from "$lib/loan-contract-customization";
import type { LoanContractData } from "$lib/loan-contract-data";
import type {
  InvestorWithLoans,
  LoanWithInvestors,
  TransactionWithInvestor,
} from "$lib/types";
import { stripContractEmbeddedImages } from "./pdf-safe-image";
import {
  resolveContractCustomizationImages,
  resolveLoanContractDataImages,
} from "$lib/server/storage/resolve-images";

export async function renderLoansPdfBuffer(
  data: LoanWithInvestors[],
  enabledSectionKeys: string[],
  investorId?: number,
): Promise<Uint8Array> {
  return renderToBuffer(
    React.createElement(LoansPDFDocument, {
      data,
      enabledSections: enabledSectionKeys,
      investorId,
    }) as any,
  );
}

export async function renderInvestorsPdfBuffer(
  data: InvestorWithLoans[],
  enabledSectionKeys: string[],
): Promise<Uint8Array> {
  return renderToBuffer(
    React.createElement(InvestorsPDFDocument, {
      data,
      enabledSections: enabledSectionKeys,
    }) as any,
  );
}

export async function renderTransactionsPdfBuffer(
  data: TransactionWithInvestor[],
  enabledSectionKeys: string[],
): Promise<Uint8Array> {
  return renderToBuffer(
    React.createElement(TransactionsPDFDocument, {
      data,
      enabledSections: enabledSectionKeys,
    }) as any,
  );
}

async function renderLoanContractDocumentToBuffer(
  data: LoanContractData,
  customization?: ContractCustomization,
): Promise<Uint8Array> {
  return renderToBuffer(
    React.createElement(LoanContractPDFDocument, {
      data,
      customization,
    }) as any,
  );
}

export async function renderLoanContractPdfBuffer(
  loan: LoanWithInvestors,
  customization?: ContractCustomization,
  contractDataOverride?: LoanContractData,
): Promise<Uint8Array> {
  const contractData = normalizeLoanContractData(
    contractDataOverride ?? buildLoanContractData(loan),
  );
  let resolvedData: LoanContractData;
  let resolvedCustomization: ContractCustomization | undefined;

  try {
    resolvedData = normalizeLoanContractData(
      await resolveLoanContractDataImages(contractData),
    );
    resolvedCustomization = customization
      ? await resolveContractCustomizationImages(customization)
      : customization;
  } catch (error) {
    console.error(
      "Contract PDF image resolution failed; rendering without embedded images:",
      error,
    );
    const stripped = stripContractEmbeddedImages(contractData, customization);
    resolvedData = stripped.data;
    resolvedCustomization = stripped.customization;
  }

  try {
    return await renderLoanContractDocumentToBuffer(
      resolvedData,
      resolvedCustomization,
    );
  } catch (error) {
    console.error(
      "Contract PDF render failed; retrying without embedded images:",
      error,
    );
    const stripped = stripContractEmbeddedImages(
      resolvedData,
      resolvedCustomization,
    );
    try {
      return await renderLoanContractDocumentToBuffer(
        stripped.data,
        stripped.customization,
      );
    } catch (retryError) {
      console.error(
        "Contract PDF render failed after stripping images; minimal retry:",
        retryError,
      );
      const minimal = stripContractEmbeddedImages(contractData, customization);
      return await renderLoanContractDocumentToBuffer(
        minimal.data,
        minimal.customization,
      );
    }
  }
}

export function pdfResponse(buffer: Uint8Array, filename: string): Response {
  // Buffer's backing ArrayBufferLike isn't structurally assignable to
  // BodyInit's Uint8Array<ArrayBuffer>. Normalize to a plain, ArrayBuffer-backed
  // Uint8Array (Response also streams this without buffering it all in memory
  // again, unlike re-wrapping in a Blob).
  const bytes = new Uint8Array(buffer);
  const safeName = filename.replace(/["\r\n]/g, "_");
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Length": String(bytes.byteLength),
    },
  });
}

export function loansPdfFilename(): string {
  const timestamp = formatDateForPDF(new Date()).replace(/\//g, "-");
  return `loans_${timestamp}.pdf`;
}

export function investorsPdfFilename(): string {
  const timestamp = formatDateForPDF(new Date()).replace(/\//g, "-");
  return `investors_${timestamp}.pdf`;
}

export function transactionsPdfFilename(): string {
  const timestamp = formatDateForPDF(new Date()).replace(/\//g, "-");
  return `transactions_${timestamp}.pdf`;
}

export function loanContractPdfFilename(loan: LoanWithInvestors): string {
  return getLoanContractFilename(loan);
}
