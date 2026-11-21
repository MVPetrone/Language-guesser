import type { LangCode } from './languages.ts'

/**
 * Other names a player might type for a language in the Daily Challenge, on
 * top of its display name and native name (both always accepted). Written in
 * any case or accents: everything is compared after `normaliseAnswer`.
 * Keep these unambiguous — an alias listed under two codes would be judged
 * correct for either.
 */
export const ALIASES: Partial<Record<LangCode, readonly string[]>> = {
  'en-US': ['american english', 'american'],
  'es-ES': ['castilian', 'castellano', 'spanish spain', 'espanol'],
  'fr-FR': ['francais'],
  'de-DE': ['deutsch'],
  'it-IT': ['italiano'],
  'pt-BR': ['portuguese', 'brazilian portuguese', 'brazilian', 'portugues', 'portugues brasileiro'],
  'ja-JP': ['nihongo'],
  'ko-KR': ['hangugeo', 'hangukeo'],
  'ar-EG': ['arabic', 'egyptian arabic', 'egyptian', 'masri'],
  'nl-NL': ['nederlands', 'netherlandic'],
  'fi-FI': ['suomi'],
  'pl-PL': ['polski'],
  'hu-HU': ['magyar'],
  'ro-RO': ['romana'],
  'el-GR': ['ellinika', 'modern greek'],
  'tr-TR': ['turkce'],
  'he-IL': ['ivrit', 'modern hebrew'],
  'fa-IR': ['farsi', 'parsi'],
  'vi-VN': ['tieng viet'],
  'fil-PH': ['tagalog', 'pilipino'],
  'sw-KE': ['kiswahili'],
  'cy-GB': ['cymraeg'],
  'ca-ES': ['catala', 'valencian'],
  'hr-HR': ['hrvatski'],
  'sr-RS': ['srpski'],
  'sl-SI': ['slovene', 'slovenscina'],
  'et-EE': ['eesti'],
  'lv-LV': ['latviesu', 'lettish'],
  'lt-LT': ['lietuviu'],
  'is-IS': ['islenska'],
  'sq-AL': ['shqip'],
  'ka-GE': ['kartuli'],
  'az-AZ': ['azeri', 'azerbaijani turkish'],
  'zh-HK': ['cantonese', 'yue', 'hong kong cantonese'],
  'zu-ZA': ['isizulu'],
  'uz-UZ': ['ozbek', 'uzbekcha'],
  'kk-KZ': ['qazaq'],
  'zh-CN': ['mandarin', 'mandarin chinese', 'putonghua', 'chinese'],
  'zh-TW': ['taiwanese mandarin', 'guoyu'],
  'hi-IN': ['hindi'],
}
