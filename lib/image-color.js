/**
 * Calculo de cor media de uma imagem, executado no servidor (Vercel).
 *
 * Sem dependencias externas: decodifica PNG usando apenas o modulo `zlib` do
 * Node. Os avatares do GitHub sao servidos como PNG (inclusive quando pedimos
 * um tamanho menor com `?s=`), por isso um decoder de PNG cobre o caso de uso.
 *
 * Se o formato nao for suportado, a funcao devolve o tema padrao marcado com
 * `computed: false` e o cliente aplica a cor padrao.
 */

import zlib from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const DEFAULT_COLOR = { r: 124, g: 77, b: 255 };

function isPng(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length > 8 &&
    buffer.subarray(0, 8).equals(PNG_SIGNATURE)
  );
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilterScanlines(raw, width, height, bytesPerPixel) {
  const stride = width * bytesPerPixel;
  const out = Buffer.alloc(stride * height);

  let position = 0;
  for (let y = 0; y < height; y += 1) {
    const filterType = raw[position];
    position += 1;
    const rowStart = y * stride;
    const previousRowStart = rowStart - stride;

    for (let x = 0; x < stride; x += 1) {
      const rawByte = raw[position + x];
      const left = x >= bytesPerPixel ? out[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? out[previousRowStart + x] : 0;
      const upLeft =
        y > 0 && x >= bytesPerPixel
          ? out[previousRowStart + x - bytesPerPixel]
          : 0;

      let value;
      switch (filterType) {
        case 0:
          value = rawByte;
          break;
        case 1:
          value = rawByte + left;
          break;
        case 2:
          value = rawByte + up;
          break;
        case 3:
          value = rawByte + ((left + up) >> 1);
          break;
        case 4:
          value = rawByte + paethPredictor(left, up, upLeft);
          break;
        default:
          throw new Error(`Filtro PNG desconhecido: ${filterType}`);
      }

      out[rowStart + x] = value & 0xff;
    }

    position += stride;
  }

  return out;
}

/**
 * Decodifica um PNG (nao entrelacado, 8 ou 16 bits, com ou sem paleta) e
 * devolve a media dos canais RGB ponderada pelo canal alfa.
 */
function averageColorFromPng(buffer) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  let interlace = 0;
  let palette = null;
  let paletteAlpha = null;
  const idatChunks = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd > buffer.length) break;

    if (type === "IHDR") {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
      interlace = buffer[dataStart + 12];
    } else if (type === "PLTE") {
      palette = buffer.subarray(dataStart, dataEnd);
    } else if (type === "tRNS" && colorType === 3) {
      paletteAlpha = buffer.subarray(dataStart, dataEnd);
    } else if (type === "IDAT") {
      idatChunks.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4; // pula o CRC
  }

  if (!width || !height || !idatChunks.length) {
    throw new Error("PNG invalido ou sem dados de imagem");
  }
  if (interlace !== 0) {
    throw new Error("PNG entrelacado (Adam7) nao suportado");
  }

  const channelsByColorType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByColorType[colorType];
  if (!channels) {
    throw new Error(`Tipo de cor PNG nao suportado: ${colorType}`);
  }
  if (bitDepth !== 8 && bitDepth !== 16) {
    throw new Error(`Profundidade de bits nao suportada: ${bitDepth}`);
  }

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const bytesPerSample = bitDepth === 16 ? 2 : 1;
  const bytesPerPixel = channels * bytesPerSample;
  const pixels = unfilterScanlines(raw, width, height, bytesPerPixel);

  const readSample = (index) => {
    if (bitDepth === 16) {
      return pixels.readUInt16BE(index * 2) >> 8; // normaliza para 0-255
    }
    return pixels[index];
  };

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let totalWeight = 0;
  const pixelCount = width * height;

  for (let i = 0; i < pixelCount; i += 1) {
    const base = i * channels;
    let r;
    let g;
    let b;
    let alpha = 255;

    if (colorType === 0) {
      r = g = b = readSample(base);
    } else if (colorType === 4) {
      r = g = b = readSample(base);
      alpha = readSample(base + 1);
    } else if (colorType === 2) {
      r = readSample(base);
      g = readSample(base + 1);
      b = readSample(base + 2);
    } else if (colorType === 6) {
      r = readSample(base);
      g = readSample(base + 1);
      b = readSample(base + 2);
      alpha = readSample(base + 3);
    } else {
      const paletteIndex = readSample(base);
      if (!palette) throw new Error("PNG com paleta sem chunk PLTE");
      r = palette[paletteIndex * 3];
      g = palette[paletteIndex * 3 + 1];
      b = palette[paletteIndex * 3 + 2];
      if (paletteAlpha && paletteIndex < paletteAlpha.length) {
        alpha = paletteAlpha[paletteIndex];
      }
    }

    const weight = alpha / 255;
    if (weight <= 0) continue;

    totalR += r * weight;
    totalG += g * weight;
    totalB += b * weight;
    totalWeight += weight;
  }

  if (!totalWeight) {
    throw new Error("Imagem totalmente transparente");
  }

  return {
    r: Math.round(totalR / totalWeight),
    g: Math.round(totalG / totalWeight),
    b: Math.round(totalB / totalWeight),
  };
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toRgb(color) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function shift(color, amount) {
  return {
    r: clampChannel(color.r + amount),
    g: clampChannel(color.g + amount),
    b: clampChannel(color.b + amount),
  };
}

/**
 * Monta a paleta que o cliente aplica em variaveis CSS.
 * Mantem o comportamento historico do site: no tema claro a media recebe +50
 * em cada canal e a cor de hover fica 30 pontos mais escura.
 */
export function buildThemeFromColor(average, options = {}) {
  const lightBoost = Number.isFinite(options.lightBoost)
    ? options.lightBoost
    : 50;
  const hoverShift = Number.isFinite(options.hoverShift)
    ? options.hoverShift
    : -30;

  const base = {
    r: clampChannel(average.r),
    g: clampChannel(average.g),
    b: clampChannel(average.b),
  };
  const light = shift(base, lightBoost);

  const buildVariant = (accent) => ({
    accent: toRgb(accent),
    accentTransparent: `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.67)`,
    hoverAccent: toRgb(shift(accent, hoverShift)),
    rgb: accent,
  });

  return {
    average: base,
    dark: buildVariant(base),
    light: buildVariant(light),
  };
}

/**
 * Baixa a imagem e calcula o tema. Nunca lanca excecao: em caso de falha
 * devolve o tema padrao com `computed: false`.
 */
export async function computeThemeFromImageUrl(url, options = {}) {
  const fallback = {
    ...buildThemeFromColor(DEFAULT_COLOR, options),
    source: url || "",
    computed: false,
    warning: "",
  };

  if (!url) {
    fallback.warning = "Nenhuma URL de imagem informada para calcular o tema.";
    return fallback;
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "portfolio-site-snapshot" },
    });
    if (!response.ok) {
      fallback.warning = `Falha ao baixar a imagem do tema (HTTP ${response.status}).`;
      return fallback;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!isPng(buffer)) {
      fallback.warning =
        "A imagem do tema nao esta em PNG; usando cor padrao no servidor.";
      return fallback;
    }

    const average = averageColorFromPng(buffer);
    return {
      ...buildThemeFromColor(average, options),
      source: url,
      computed: true,
      warning: "",
    };
  } catch (error) {
    fallback.warning = `Nao foi possivel calcular a cor media: ${error.message}`;
    return fallback;
  }
}

export const DEFAULT_THEME_COLOR = DEFAULT_COLOR;
