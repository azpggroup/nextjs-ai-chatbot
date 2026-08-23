#!/usr/bin/env node
/**
 * Generate an illustrative educational/info slide (carousel content) using
 * Gemini 2.5 Flash Image. Pure design graphic — no real product photo involved.
 * Optionally references the brand logo for consistency.
 *
 * Usage:
 *   node scripts/gemini-info-slide.js <output-path> <title> <body> [logo-path]
 *
 * Requires GEMINI_API_KEY in the environment.
 */

const fs = require("node:fs");
const path = require("node:path");

const MODEL = "gemini-2.5-flash-image";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function buildPrompt(title, body, hasLogo) {
  return `
You are designing ONE slide (square 1:1) of an educational carousel for "Đại Chúng Properties",
a quiet-luxury Vietnamese real estate brand. This is a DESIGN GRAPHIC with text, not a real estate
photo — do not depict any building, room, or architecture.

${hasLogo ? "Use the attached logo EXACTLY as provided (do not redraw or distort it), placed small and tasteful in a corner (e.g. bottom-right)." : ""}

Composition:
- Background: elegant abstract/minimal composition using the brand palette — charcoal black,
  champagne gold / bronze accents, ivory white, deep navy blue. Subtle gradients, fine gold
  linework or geometric accents, generous negative space.
- Render this EXACT Vietnamese text accurately, with correct diacritics, no spelling mistakes,
  no distorted or garbled letters, properly centered and fully legible:

TITLE (large, elegant serif or thin sans-serif, champagne gold or ivory):
"${title}"

BODY (smaller, clean sans-serif, ivory or light gray, arranged in short readable lines):
"${body}"

- Square format (1:1), suitable for Instagram/Facebook carousel.
- Overall mood: quiet luxury, editorial, informative — not flashy, no stock-photo clichés,
  no cartoonish icons unless very minimal line-art.

Output one final designed image only.
`.trim();
}

async function main() {
  const [, , outputPath, title, body, logoPath] = process.argv;

  if (!outputPath || !title || !body) {
    console.error(
      "Usage: node scripts/gemini-info-slide.js <output-path> <title> <body> [logo-path]"
    );
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY environment variable.");
    process.exit(1);
  }

  const parts = [{ text: buildPrompt(title, body, !!logoPath) }];

  if (logoPath) {
    const absLogo = path.resolve(logoPath);
    const logoBuffer = fs.readFileSync(absLogo);
    parts.push({
      inline_data: {
        mime_type: guessMimeType(absLogo),
        data: logoBuffer.toString("base64"),
      },
    });
  }

  const requestBody = {
    contents: [{ role: "user", parts }],
    generationConfig: { responseModalities: ["IMAGE"] },
  };

  console.log(`Generating info slide "${title}" using ${MODEL}...`);

  const res = await fetch(`${API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Gemini API error ${res.status}: ${errText}`);
    process.exit(1);
  }

  const json = await res.json();
  const respParts = json?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = respParts.find((p) => p.inlineData || p.inline_data);
  const inlineData = imagePart?.inlineData ?? imagePart?.inline_data;

  if (!inlineData?.data) {
    console.error("No image returned by Gemini. Full response:");
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }

  const outBuffer = Buffer.from(inlineData.data, "base64");
  const absOutput = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absOutput), { recursive: true });
  fs.writeFileSync(absOutput, outBuffer);

  console.log(`Saved info slide to ${absOutput} (${outBuffer.length} bytes)`);
}

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
