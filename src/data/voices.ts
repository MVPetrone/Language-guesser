import type { LangCode } from './languages.ts'

/**
 * Two edge-tts voices per language: index 0 is female, index 1 is male. Each is
 * the lowest voice id of its gender in the language's locale family (plain
 * code-unit order, so `zh-CN-XiaoxiaoNeural` sorts before the dialect voice
 * `zh-CN-liaoning-XiaobeiNeural`). The index is part of every clip path
 * (`audio/<code>/<index>/<sentence>.mp3`), so never reorder a list.
 * `no-NO` has no voices of its own; it uses its family `nb-NO`.
 * Checked against `edge-tts --list-voices` by `node scripts/validate_voices.mts`.
 */
export const VOICES_BY_LANG: Record<LangCode, readonly string[]> = {
  'en-US': ['en-US-AnaNeural', 'en-US-AndrewMultilingualNeural'],
  'es-ES': ['es-ES-ElviraNeural', 'es-ES-AlvaroNeural'],
  'fr-FR': ['fr-FR-DeniseNeural', 'fr-FR-HenriNeural'],
  'de-DE': ['de-DE-AmalaNeural', 'de-DE-ConradNeural'],
  'it-IT': ['it-IT-ElsaNeural', 'it-IT-DiegoNeural'],
  'pt-BR': ['pt-BR-FranciscaNeural', 'pt-BR-AntonioNeural'],
  'ja-JP': ['ja-JP-NanamiNeural', 'ja-JP-KeitaNeural'],
  'ko-KR': ['ko-KR-SunHiNeural', 'ko-KR-HyunsuMultilingualNeural'],
  'ar-EG': ['ar-EG-SalmaNeural', 'ar-EG-ShakirNeural'],
  'nl-NL': ['nl-NL-ColetteNeural', 'nl-NL-MaartenNeural'],
  'fi-FI': ['fi-FI-NooraNeural', 'fi-FI-HarriNeural'],
  'pl-PL': ['pl-PL-ZofiaNeural', 'pl-PL-MarekNeural'],
  'hu-HU': ['hu-HU-NoemiNeural', 'hu-HU-TamasNeural'],
  'ro-RO': ['ro-RO-AlinaNeural', 'ro-RO-EmilNeural'],
  'bg-BG': ['bg-BG-KalinaNeural', 'bg-BG-BorislavNeural'],
  'el-GR': ['el-GR-AthinaNeural', 'el-GR-NestorasNeural'],
  'tr-TR': ['tr-TR-EmelNeural', 'tr-TR-AhmetNeural'],
  'he-IL': ['he-IL-HilaNeural', 'he-IL-AvriNeural'],
  'fa-IR': ['fa-IR-DilaraNeural', 'fa-IR-FaridNeural'],
  'th-TH': ['th-TH-PremwadeeNeural', 'th-TH-NiwatNeural'],
  'vi-VN': ['vi-VN-HoaiMyNeural', 'vi-VN-NamMinhNeural'],
  'fil-PH': ['fil-PH-BlessicaNeural', 'fil-PH-AngeloNeural'],
  'sw-KE': ['sw-KE-ZuriNeural', 'sw-KE-RafikiNeural'],
  'af-ZA': ['af-ZA-AdriNeural', 'af-ZA-WillemNeural'],
  'cy-GB': ['cy-GB-NiaNeural', 'cy-GB-AledNeural'],
  'sv-SE': ['sv-SE-SofieNeural', 'sv-SE-MattiasNeural'],
  'da-DK': ['da-DK-ChristelNeural', 'da-DK-JeppeNeural'],
  'no-NO': ['nb-NO-PernilleNeural', 'nb-NO-FinnNeural'],
  'cs-CZ': ['cs-CZ-VlastaNeural', 'cs-CZ-AntoninNeural'],
  'sk-SK': ['sk-SK-ViktoriaNeural', 'sk-SK-LukasNeural'],
  'ru-RU': ['ru-RU-SvetlanaNeural', 'ru-RU-DmitryNeural'],
  'uk-UA': ['uk-UA-PolinaNeural', 'uk-UA-OstapNeural'],
  'id-ID': ['id-ID-GadisNeural', 'id-ID-ArdiNeural'],
  'ms-MY': ['ms-MY-YasminNeural', 'ms-MY-OsmanNeural'],
  'zh-CN': ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunjianNeural'],
  'zh-TW': ['zh-TW-HsiaoChenNeural', 'zh-TW-YunJheNeural'],
  'hi-IN': ['hi-IN-SwaraNeural', 'hi-IN-MadhurNeural'],
  'ur-PK': ['ur-PK-UzmaNeural', 'ur-PK-AsadNeural'],
  'bn-BD': ['bn-BD-NabanitaNeural', 'bn-BD-PradeepNeural'],
  'ta-IN': ['ta-IN-PallaviNeural', 'ta-IN-ValluvarNeural'],
}
