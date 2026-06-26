import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { Invoice, InvoiceItem, Organization, Client, Project } from '@/types/domain';

const BRAND_COLOR: [number, number, number] = [37, 99, 235];

/**
 * Génération de factures au format Factur-X (PDF/A-3 + XML CII embarqué).
 *
 * Portée volontairement limitée à cette itération : on produit un fichier
 * conforme au *format* Factur-X (profil BASIC — visuel PDF + XML CII
 * structuré, pièce jointe /AF avec AFRelationship "Data") afin qu'il soit
 * déposable sur la Plateforme de Dématérialisation Partenaire (PDP) choisie
 * par l'utilisateur. La transmission effective à une PDP (obligatoire au
 * 1er sept. 2026/2027 selon la taille d'entreprise) est hors-périmètre :
 * c'est un chantier d'intégration à part (cf. tâche #146 et suivantes).
 *
 * Remarque PDF/A-3 : une conformité PDF/A-3 strictement validable (profils
 * couleur ICC, polices entièrement embarquées, etc.) demanderait un moteur
 * PDF dédié. Ici on vise le sous-ensemble qui compte en pratique pour
 * l'interopérabilité Factur-X : XML CII bien formé, embarqué en pièce
 * jointe standard PDF avec relation "Data", et métadonnées XMP déclarant le
 * type de document et le profil Factur-X — c'est ce que les outils
 * d'extraction (et la plupart des PDP) lisent réellement.
 */

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Format de date CII "102" : CCYYMMDD. */
function ciiDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

function amt(value: number): string {
  return value.toFixed(2);
}

export interface FacturXContext {
  invoice: Invoice;
  items: InvoiceItem[];
  organization: Organization;
  client: Client | null;
  project: Project;
}

/**
 * Construit le XML CII (Cross Industry Invoice) profil BASIC de Factur-X
 * 1.0.7 à partir de la facture. Couvre les blocs obligatoires du profil :
 * contexte/guideline, parties (vendeur/acheteur), lignes, totaux et
 * conditions de paiement.
 */
export function buildFacturXXml(ctx: FacturXContext): string {
  const { invoice, items, organization, client } = ctx;

  const sellerVat = organization.vat_number
    ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${xmlEscape(organization.vat_number)}</ram:ID></ram:SpecifiedTaxRegistration>`
    : '';
  const buyerVat = client?.vat_number
    ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${xmlEscape(client.vat_number)}</ram:ID></ram:SpecifiedTaxRegistration>`
    : '';

  const lineItems = items
    .map(
      (item, index) => `
      <ram:IncludedSupplyChainTradeLineItem>
        <ram:AssociatedDocumentLineDocument>
          <ram:LineID>${index + 1}</ram:LineID>
        </ram:AssociatedDocumentLineDocument>
        <ram:SpecifiedTradeProduct>
          <ram:Name>${xmlEscape(item.description)}</ram:Name>
        </ram:SpecifiedTradeProduct>
        <ram:SpecifiedLineTradeAgreement>
          <ram:NetPriceProductTradePrice>
            <ram:ChargeAmount>${amt(item.unit_price)}</ram:ChargeAmount>
          </ram:NetPriceProductTradePrice>
        </ram:SpecifiedLineTradeAgreement>
        <ram:SpecifiedLineTradeDelivery>
          <ram:BilledQuantity unitCode="${xmlEscape(item.unit || 'C62')}">${item.quantity}</ram:BilledQuantity>
        </ram:SpecifiedLineTradeDelivery>
        <ram:SpecifiedLineTradeSettlement>
          <ram:ApplicableTradeTax>
            <ram:TypeCode>VAT</ram:TypeCode>
            <ram:CategoryCode>S</ram:CategoryCode>
            <ram:RateApplicablePercent>${amt(item.vat_rate)}</ram:RateApplicablePercent>
          </ram:ApplicableTradeTax>
          <ram:SpecifiedTradeSettlementLineMonetarySummation>
            <ram:LineTotalAmount>${amt(item.line_total)}</ram:LineTotalAmount>
          </ram:SpecifiedTradeSettlementLineMonetarySummation>
        </ram:SpecifiedLineTradeSettlement>
      </ram:IncludedSupplyChainTradeLineItem>`
    )
    .join('');

  // Ventilation de la TVA par taux (obligatoire : un bloc ApplicableTradeTax
  // par taux distinct présent sur les lignes).
  const vatByRate = new Map<number, { basis: number; vat: number }>();
  for (const item of items) {
    const entry = vatByRate.get(item.vat_rate) ?? { basis: 0, vat: 0 };
    entry.basis += item.line_total;
    entry.vat += item.line_total * (item.vat_rate / 100);
    vatByRate.set(item.vat_rate, entry);
  }
  const vatBreakdown = Array.from(vatByRate.entries())
    .map(
      ([rate, { basis, vat }]) => `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${amt(vat)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${amt(basis)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${amt(rate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`
    )
    .join('');

  const paymentTerms = invoice.due_date
    ? `<ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">${ciiDate(invoice.due_date)}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>`
    : '';

  const payeeAccount = organization.iban
    ? `<ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${xmlEscape(organization.iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
        ${organization.bic ? `<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${xmlEscape(organization.bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}
      </ram:SpecifiedTradeSettlementPaymentMeans>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${xmlEscape(String(invoice.number ?? ''))}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${ciiDate(invoice.issue_date)}</udt:DateTimeString>
    </ram:IssueDateTime>
    ${invoice.notes ? `<ram:IncludedNote><ram:Content>${xmlEscape(invoice.notes)}</ram:Content></ram:IncludedNote>` : ''}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    ${lineItems}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${xmlEscape(organization.name)}</ram:Name>
        ${organization.siret ? `<ram:ID schemeID="0009">${xmlEscape(organization.siret)}</ram:ID>` : ''}
        <ram:PostalTradeAddress>
          <ram:LineOne>${xmlEscape(organization.legal_address ?? '')}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        ${sellerVat}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${xmlEscape(client?.name ?? client?.company_name ?? 'Client')}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:LineOne>${xmlEscape(client?.billing_address ?? client?.address ?? '')}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        ${buyerVat}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${xmlEscape(invoice.currency)}</ram:InvoiceCurrencyCode>
      ${payeeAccount}
      ${vatBreakdown}
      ${paymentTerms}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${amt(invoice.subtotal)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${amt(invoice.subtotal)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${xmlEscape(invoice.currency)}">${amt(invoice.vat_amount)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${amt(invoice.total)}</ram:GrandTotalAmount>
        <ram:TotalPrepaidAmount>${amt(invoice.amount_paid)}</ram:TotalPrepaidAmount>
        <ram:DuePayableAmount>${amt(invoice.total - invoice.amount_paid)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

/** Construit le visuel PDF de la facture (sans le XML embarqué). */
function buildInvoiceVisualPdf(ctx: FacturXContext): jsPDF {
  const { invoice, items, organization, client, project } = ctx;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageWidth, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('BuildFlow', 40, 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Facture n° ${invoice.number ?? '—'}`, 40, 48);
  doc.setTextColor(30, 41, 59);

  let y = 90;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Chantier : ${project.name}`, 40, y);
  doc.text(`Émise le ${format(new Date(invoice.issue_date), 'dd/MM/yyyy')}`, pageWidth - 40, y, { align: 'right' });
  y += 30;

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, textColor: [51, 65, 85] },
    body: [
      [
        'Émetteur',
        `${organization.name}\n${organization.legal_address ?? ''}\nSIRET : ${organization.siret ?? '—'}  TVA : ${organization.vat_number ?? '—'}`,
      ],
      [
        'Client',
        `${client?.company_name ?? client?.name ?? '—'}\n${client?.billing_address ?? client?.address ?? ''}\nSIRET : ${client?.siret ?? '—'}  TVA : ${client?.vat_number ?? '—'}`,
      ],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 90 } },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qté', 'Unité', 'Prix unit. HT', 'TVA', 'Total HT']],
    body: items.map((item) => [
      item.description,
      String(item.quantity),
      item.unit,
      `${item.unit_price.toLocaleString('fr-FR')} €`,
      `${item.vat_rate} %`,
      `${item.line_total.toLocaleString('fr-FR')} €`,
    ]),
    headStyles: { fillColor: BRAND_COLOR },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 200 } },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, textColor: [51, 65, 85] },
    body: [
      ['Total HT', `${invoice.subtotal.toLocaleString('fr-FR')} €`],
      ['TVA', `${invoice.vat_amount.toLocaleString('fr-FR')} €`],
      ['Total TTC', `${invoice.total.toLocaleString('fr-FR')} €`],
      ['Déjà réglé', `${invoice.amount_paid.toLocaleString('fr-FR')} €`],
      ['Solde dû', `${(invoice.total - invoice.amount_paid).toLocaleString('fr-FR')} €`],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 110 }, 1: { halign: 'right' } },
    tableWidth: 220,
    margin: { left: pageWidth - 40 - 220 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const mentions = [
    `Échéance de paiement : ${invoice.due_date ? format(new Date(invoice.due_date), 'dd/MM/yyyy') : '—'} (${invoice.payment_terms_days ?? 30} jours).`,
    invoice.late_penalty_rate
      ? `Pénalités de retard : ${invoice.late_penalty_rate} % par an au-delà de l'échéance.`
      : 'Pénalités de retard applicables au taux légal en vigueur au-delà de l\'échéance.',
    `Indemnité forfaitaire pour frais de recouvrement : ${(invoice.recovery_indemnity_amount ?? 40).toLocaleString('fr-FR')} € (art. L441-10 C. com.).`,
    organization.iban ? `IBAN : ${organization.iban}${organization.bic ? `  BIC : ${organization.bic}` : ''}` : '',
    'Document généré au format Factur-X (PDF/A-3 + XML CII embarqué).',
  ].filter(Boolean);
  for (const line of mentions) {
    doc.text(line, 40, y);
    y += 11;
  }

  return doc;
}

/**
 * Génère le PDF Factur-X complet : visuel + XML CII embarqué en pièce
 * jointe standard PDF (AFRelationship "Data", référencé dans le tableau
 * /AF du catalogue) avec métadonnées XMP déclarant le profil Factur-X.
 * pdf-lib est importé dynamiquement pour ne pas alourdir le bundle
 * principal (chargé uniquement lors d'une génération de facture).
 */
export async function buildFacturXPdf(ctx: FacturXContext): Promise<Uint8Array> {
  const visualDoc = buildInvoiceVisualPdf(ctx);
  const pdfBytes = visualDoc.output('arraybuffer') as ArrayBuffer;

  const { PDFDocument, PDFName, AFRelationship } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.setTitle(`Facture ${ctx.invoice.number ?? ''} — ${ctx.organization.name}`);
  pdfDoc.setSubject('Factur-X Invoice');
  pdfDoc.setProducer('BuildFlow');
  pdfDoc.setCreator('BuildFlow');

  const xml = buildFacturXXml(ctx);
  const xmlBytes = new TextEncoder().encode(xml);

  // pdf-lib's attach() + afRelationship suffit : PDFEmbeddedFile.embed()
  // (appelé automatiquement par save()) écrit lui-même la pièce jointe à la
  // fois dans /Names/EmbeddedFiles et dans le tableau /AF du catalogue
  // (cf. node_modules/pdf-lib/cjs/api/PDFEmbeddedFile.js) — aucun bricolage
  // manuel du catalogue n'est nécessaire.
  await pdfDoc.attach(xmlBytes, 'factur-x.xml', {
    mimeType: 'text/xml',
    description: 'Facture électronique Factur-X (CII, profil BASIC)',
    creationDate: new Date(ctx.invoice.created_at),
    modificationDate: new Date(),
    afRelationship: AFRelationship.Data,
  });

  const catalog = pdfDoc.catalog;

  // Métadonnées XMP minimales déclarant le document comme Factur-X /
  // ZUGFeRD (espace de noms fx) afin que les outils d'extraction
  // reconnaissent le fichier sans avoir à parser le XML embarqué.
  // eslint-disable-next-line no-irregular-whitespace -- BOM littéral requis par la spec XMP packet wrapper
  const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>BASIC</fx:ConformanceLevel>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  const xmpBytes = new TextEncoder().encode(xmp);
  const metadataStreamRef = pdfDoc.context.register(
    pdfDoc.context.stream(xmpBytes, { Type: PDFName.of('Metadata'), Subtype: PDFName.of('XML') })
  );
  catalog.set(PDFName.of('Metadata'), metadataStreamRef);

  return pdfDoc.save();
}

export function facturXPdfToFile(bytes: Uint8Array, filename: string): File {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new File([buffer], filename, { type: 'application/pdf' });
}
