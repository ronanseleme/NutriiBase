// Baixa todos os arquivos dos buckets do Supabase Storage pra uma pasta
// local, usada pelo workflow .github/workflows/backup-diario.yml.
//
// O backup nativo do Supabase (Database > Backups) não inclui os objetos
// do Storage, só os metadados — por isso este script existe: sem ele,
// fotos de refeição e avatares dos usuários não têm nenhum backup.
//
// Usa fetch nativo (Node 18+) direto contra a Storage REST API, sem
// dependências, pra não precisar de "npm install" no workflow de CI.
//
// Uso: node backup-storage.mjs <pasta-destino>
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BUCKETS = ["meal-photos", "avatars"];

const destino = process.argv[2];
if (!destino) {
  console.error("Uso: node backup-storage.mjs <pasta-destino>");
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Faltam as env vars SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  apikey: SERVICE_ROLE_KEY,
  "Content-Type": "application/json",
};

async function listarTudo(bucket, prefixo = "") {
  const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prefix: prefixo, limit: 1000, sortBy: { column: "name", order: "asc" } }),
  });
  if (!resp.ok) {
    throw new Error(`Erro listando ${bucket}/${prefixo}: ${resp.status} ${await resp.text()}`);
  }
  const itens = await resp.json();

  const arquivos = [];
  for (const item of itens) {
    const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
    // Pastas vêm sem "id" no retorno do Storage API — arquivos têm.
    if (item.id === null) {
      arquivos.push(...(await listarTudo(bucket, caminho)));
    } else {
      arquivos.push(caminho);
    }
  }
  return arquivos;
}

async function baixarBucket(bucket) {
  const arquivos = await listarTudo(bucket);
  console.log(`${bucket}: ${arquivos.length} arquivo(s)`);

  for (const arquivo of arquivos) {
    const resp = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(arquivo)}`,
      { headers }
    );
    if (!resp.ok) {
      console.error(`Falha ao baixar ${bucket}/${arquivo}: ${resp.status}`);
      continue;
    }
    const destinoArquivo = path.join(destino, bucket, arquivo);
    await mkdir(path.dirname(destinoArquivo), { recursive: true });
    await writeFile(destinoArquivo, Buffer.from(await resp.arrayBuffer()));
  }
}

for (const bucket of BUCKETS) {
  await baixarBucket(bucket);
}

console.log("Backup de Storage concluído.");
