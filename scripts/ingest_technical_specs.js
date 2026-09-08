import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mdPath = path.resolve(__dirname, '../web/data/master_technical_database.md');
const content = fs.readFileSync(mdPath, 'utf8');

// Regex to split companies by "### [number]. [Company Name]"
const companyBlocks = content.split(/^### \d+\.\s+/m).slice(1);

console.log(`Found ${companyBlocks.length} company blocks.`);

const parsedCompanies = [];

for (const block of companyBlocks) {
  const lines = block.split('\n');
  const name = lines[0].trim();

  // Extract directory slug
  const slugMatch = block.match(/\* \*\*Directory Slug:\*\*\s*`([^`]+)`/);
  const slug = slugMatch ? slugMatch[1].trim() : null;
  if (!slug) continue;

  // Extract location
  const locMatch = block.match(/\* \*\*Location:\*\*\s*(.+)/);
  const location = locMatch ? locMatch[1].trim() : null;

  // Extract official website
  const webMatch = block.match(/\* \*\*Official Website:\*\*\s*(.+)/);
  let website = null;
  if (webMatch) {
    const rawWeb = webMatch[1].trim();
    const urlMatch = rawWeb.match(/https?:\/\/[^\s\)]+/);
    if (urlMatch) {
      website = urlMatch[0];
    }
  }

  // Extract Capability Overview
  let overview = null;
  const overviewMatch = block.match(/\*\*Capability Overview:\*\*\s*([\s\S]*?)(?=\*\*Technical Specifications|\*\*Testing & Quality|---|$)/);
  if (overviewMatch) {
    overview = overviewMatch[1].trim().replace(/\n+/g, ' ');
  }

  // Extract Technical Specifications & Production Envelope
  const specsMatch = block.match(/\*\*Technical Specifications & Production Envelope:\*\*\s*([\s\S]*?)(?=\*\*Testing & Quality|---|$)/);
  const specsRaw = specsMatch ? specsMatch[1].trim() : '';

  // Extract Testing & Quality Certifications
  const certsMatch = block.match(/\*\*Testing & Quality Certifications:\*\*\s*(.+)/);
  const certsRaw = certsMatch ? certsMatch[1].trim() : '';

  // Parse specifications into structured products
  const products = [];
  if (specsRaw) {
    const specLines = specsRaw.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Group bullet points
    const specItems = [];
    let currentBullet = null;
    for (const l of specLines) {
      if (l.startsWith('- ') || l.startsWith('* ')) {
        if (currentBullet) specItems.push(currentBullet);
        currentBullet = l.replace(/^[-*]\s+/, '');
      } else if (currentBullet) {
        currentBullet += ' ' + l;
      }
    }
    if (currentBullet) specItems.push(currentBullet);

    // Build key-value map from bullets
    const specDict = {};
    const subProducts = [];

    for (const item of specItems) {
      const parts = item.split(/:\s*(.+)/);
      if (parts.length >= 2) {
        const key = parts[0].replace(/\*\*/g, '').trim();
        const val = parts[1].replace(/\*\*/g, '').trim();
        specDict[key] = val;

        // Check if this bullet looks like a distinct major product
        if (/Product|Flagship|Distribution|Power|Modular|Junction|Substations|Die Casting|Injection/i.test(key) && val.length > 10) {
          subProducts.push({
            name: `${key}: ${val.split(/[,(]/)[0].trim()}`,
            description: val,
            specs: { [key]: val }
          });
        }
      }
    }

    if (subProducts.length > 0) {
      for (const sp of subProducts) {
        // Merge general specs
        sp.specs = { ...sp.specs, ...specDict };
        products.push(sp);
      }
    } else if (Object.keys(specDict).length > 0) {
      // Product using specDict
      products.push({
        name: `${name} — Manufacturing Capabilities`,
        description: overview || `Manufactured specifications and production envelope for ${name}.`,
        specs: specDict
      });
    }
  }

  // Fallback: If no products were created yet, create one from Capability Overview so no company is empty
  if (products.length === 0 && overview) {
    products.push({
      name: `${name} — Industrial Capabilities`,
      description: overview,
      specs: {
        "Capability": overview.length > 120 ? overview.slice(0, 117) + '...' : overview,
        "Cluster / Location": location || 'India',
        "Directory Verification": 'Indexed via SpecGrid Master Technical Database'
      }
    });
  }

  // Parse certifications
  const certs = [];
  if (certsRaw) {
    const splitCerts = certsRaw.split(/[,;]\s*/);
    for (const c of splitCerts) {
      const cleanCert = c.trim();
      if (!cleanCert) continue;
      let issuingBody = null;
      let verified = 0;
      if (/CPRI/i.test(cleanCert)) { issuingBody = 'CPRI'; verified = 1; }
      else if (/ERDA/i.test(cleanCert)) { issuingBody = 'ERDA'; verified = 1; }
      else if (/NABL/i.test(cleanCert)) { issuingBody = 'NABL'; verified = 1; }
      else if (/UL/i.test(cleanCert)) { issuingBody = 'UL'; verified = 1; }
      else if (/BIS|ISI/i.test(cleanCert)) { issuingBody = 'BIS'; verified = 1; }
      else if (/ISO 9001/i.test(cleanCert)) { issuingBody = 'ISO'; verified = 1; }
      else if (/ISO 14001|ISO 45001/i.test(cleanCert)) { issuingBody = 'ISO'; verified = 1; }
      else if (/CE/i.test(cleanCert)) { issuingBody = 'EU CE'; verified = 1; }

      certs.push({
        name: cleanCert,
        issuingBody,
        verified
      });
    }
  }

  parsedCompanies.push({
    slug,
    name,
    location,
    website,
    overview,
    products,
    certs
  });
}

console.log(`Parsed ${parsedCompanies.length} companies.`);
const totalProducts = parsedCompanies.reduce((acc, c) => acc + c.products.length, 0);
const totalCerts = parsedCompanies.reduce((acc, c) => acc + c.certs.length, 0);
const withWebsites = parsedCompanies.filter(c => c.website).length;

console.log(`Total Products extracted: ${totalProducts}`);
console.log(`Total Certifications extracted: ${totalCerts}`);
console.log(`Companies with verified websites: ${withWebsites}`);

// Generate SQL migration file
let sql = `-- SpecGrid Master Technical Database Ingestion\n`;
sql += `-- Generated: ${new Date().toISOString()}\n\n`;

for (const c of parsedCompanies) {
  // 1. Update company description & website
  if (c.overview || c.website) {
    const descSql = c.overview ? `'${c.overview.replace(/'/g, "''")}'` : 'description';
    const webSql = c.website ? `'${c.website.replace(/'/g, "''")}'` : 'website';
    sql += `UPDATE companies SET description = ${descSql}, website = COALESCE(${webSql}, website), updated_at = datetime('now') WHERE slug = '${c.slug}';\n`;
  }

  // 2. Clear old draft products for this company to avoid duplicates
  sql += `DELETE FROM products WHERE company_id = (SELECT id FROM companies WHERE slug = '${c.slug}');\n`;

  // 3. Insert structured products
  c.products.forEach((p, idx) => {
    const prodId = `prod_${c.slug}_${idx + 1}`.slice(0, 64);
    const prodSlug = `${c.slug}-p${idx + 1}`.slice(0, 64);
    const prodName = p.name.replace(/'/g, "''");
    const prodDesc = (p.description || '').replace(/'/g, "''");
    const specsJson = JSON.stringify(p.specs).replace(/'/g, "''");

    sql += `INSERT INTO products (id, company_id, category_id, slug, name, description, status, specs, created_at, updated_at)
VALUES ('${prodId}', (SELECT id FROM companies WHERE slug = '${c.slug}'), (SELECT category_id FROM companies WHERE slug = '${c.slug}'), '${prodSlug}', '${prodName}', '${prodDesc}', 'published', '${specsJson}', datetime('now'), datetime('now'));\n`;
  });

  // 4. Insert certifications
  c.certs.forEach((cert, idx) => {
    const certId = `cert_${c.slug}_${idx + 1}`.slice(0, 64);
    const certName = cert.name.replace(/'/g, "''");
    const certIssuer = cert.issuingBody ? `'${cert.issuingBody.replace(/'/g, "''")}'` : 'NULL';

    // Insert or replace
    sql += `INSERT OR REPLACE INTO certifications (id, company_id, name, issuing_body, verified)
VALUES ('${certId}', (SELECT id FROM companies WHERE slug = '${c.slug}'), '${certName}', ${certIssuer}, ${cert.verified});\n`;
  });
}

const outSqlPath = path.resolve(__dirname, '../db/ingest_technical_specs.sql');
fs.writeFileSync(outSqlPath, sql);
console.log(`Wrote SQL batch file to: ${outSqlPath}`);
