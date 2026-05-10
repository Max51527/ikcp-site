#!/usr/bin/env node
/**
 * © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
 *
 * Génère N codes beta uniques au format BETA-FAMI-XXXX-YYYY et produit le
 * SQL d'insertion pour D1 (workers/ikcp-client/schema.sql · table beta_codes).
 *
 * Usage :
 *   node scripts/generate-beta-codes.mjs --count 50 [--source "linkedin"] [--notes "Cohorte 1 S2 2026"]
 *   node scripts/generate-beta-codes.mjs --count 1 --notes "Famille X · CA 12 M€" --source "rdv-maxime"
 *
 * Output :
 *   · Liste des codes dans la sortie standard
 *   · Fichier scripts/output/beta-codes-<timestamp>.sql avec INSERT prêts pour D1
 *   · Fichier scripts/output/beta-codes-<timestamp>.csv pour suivi commercial Maxime
 *
 * Ensuite :
 *   wrangler d1 execute ikcp-client-db --file=scripts/output/beta-codes-<timestamp>.sql --remote
 *
 * Conformité :
 *  · Codes générés via crypto.randomBytes (cryptographically secure)
 *  · Vérification d'unicité côté D1 via PRIMARY KEY
 *  · Source et notes loggés pour traçabilité (audit RGPD)
 */

import crypto from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ─── Parsing arguments ──────────────────────────────────────────────────
const args = process.argv.slice(2);
const arg = (key, def = null) => {
  const i = args.indexOf('--' + key);
  return i === -1 ? def : args[i + 1];
};
const count = parseInt(arg('count', '1'), 10);
const source = arg('source', 'manual');
const notes = arg('notes', '');
const expiresInDays = parseInt(arg('expires-in-days', '180'), 10); // 6 mois
const maxUses = parseInt(arg('max-uses', '1'), 10);

if (!count || count < 1 || count > 200) {
  console.error('Usage: node generate-beta-codes.mjs --count <1-200> [--source <str>] [--notes <str>] [--expires-in-days <int>]');
  process.exit(1);
}

// ─── Génération de codes ────────────────────────────────────────────────
function generateCode() {
  // BETA-FAMI-XXXX-YYYY · 8 chars alphanumériques (sans 0/O/1/I confusion)
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = (n) => Array.from({ length: n }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
  return `BETA-FAMI-${seg(4)}-${seg(4)}`;
}

const codes = new Set();
while (codes.size < count) {
  codes.add(generateCode());
}
const codesArray = [...codes];

// ─── Préparation des données ────────────────────────────────────────────
const now = Date.now();
const expiresAt = expiresInDays > 0 ? now + (expiresInDays * 24 * 3600 * 1000) : null;
const notesEscaped = notes.replace(/'/g, "''");
const sourceEscaped = source.replace(/'/g, "''");

// ─── SQL output ─────────────────────────────────────────────────────────
const sqlValues = codesArray.map(code =>
  `('${code}', ${maxUses}, 0, NULL, ${now}, ${expiresAt || 'NULL'}, '${notesEscaped}', '${sourceEscaped}')`
).join(',\n  ');

const sql = `-- IKCP — Insertion ${count} code(s) beta · généré ${new Date().toISOString()}
-- Source : ${source}
-- Notes  : ${notes}
-- Expire : ${expiresAt ? new Date(expiresAt).toISOString().slice(0, 10) : 'jamais'}
-- Max uses par code : ${maxUses}

INSERT INTO beta_codes (code, max_uses, used_count, used_by_email, created_at, expires_at, notes, source) VALUES
  ${sqlValues};
`;

// ─── CSV output (pour suivi commercial Maxime) ──────────────────────────
const csv = [
  'code,max_uses,created_at_iso,expires_at_iso,source,notes',
  ...codesArray.map(code => [
    code,
    maxUses,
    new Date(now).toISOString(),
    expiresAt ? new Date(expiresAt).toISOString() : '',
    source,
    `"${notes.replace(/"/g, '""')}"`,
  ].join(','))
].join('\n');

// ─── Écriture fichiers ──────────────────────────────────────────────────
const outDir = join(import.meta.dirname || '.', 'output');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const sqlPath = join(outDir, `beta-codes-${ts}.sql`);
const csvPath = join(outDir, `beta-codes-${ts}.csv`);

writeFileSync(sqlPath, sql);
writeFileSync(csvPath, csv);

// ─── Output console ─────────────────────────────────────────────────────
console.log(`\n✅ ${count} code(s) beta généré(s) :\n`);
codesArray.forEach((c, i) => console.log(`  ${String(i + 1).padStart(3, ' ')}. ${c}`));
console.log(`\n📄 SQL prêt pour D1 : ${sqlPath}`);
console.log(`📊 CSV suivi commercial : ${csvPath}`);
console.log(`\n🚀 Pour insérer dans D1 :`);
console.log(`   wrangler d1 execute ikcp-client-db --file=${sqlPath} --remote\n`);
