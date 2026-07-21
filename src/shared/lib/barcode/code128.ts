// shared/lib/barcode/code128.ts
// Code 128B encoding — mirrors w12/engine/barcode-encode.ts

const C128_WIDTHS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','233111',
];

const START_B = 104;
const STOP = 106;

export interface EncodeResult {
  symbols: number[];
  checkDigit: number;
}

/**
 * Encodes a string into Code 128B symbol values.
 * Returns numeric symbol indices (0-106) for direct C128_WIDTHS lookup.
 */
export function code128Encode(text: string): EncodeResult {
  const values: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) {
      values.push(code - 32);
    }
  }

  let checksum = START_B;
  values.forEach((v, i) => { checksum += v * (i + 1); });
  const check = checksum % 103;

  return { symbols: [START_B, ...values, check, STOP], checkDigit: check };
}

/**
 * Converts symbol values to flat bar/space width modules.
 * Each symbol → 6-digit string from C128_WIDTHS → 6 width numbers.
 * STOP symbol gets an extra 2-unit termination bar.
 */
export function symbolsToModules(symbols: number[]): number[] {
  const modules: number[] = [];
  for (const sym of symbols) {
    for (const ch of C128_WIDTHS[sym]) {
      modules.push(Number(ch));
    }
  }
  modules.push(2); // termination bar
  return modules;
}

export { C128_WIDTHS };
