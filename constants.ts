import { LanguageOption } from './types';

export const AUTO_DETECT: LanguageOption = {
  code: 'auto',
  name: 'Auto Detect',
  nativeName: 'Detect Language',
  flag: '✨'
};

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'Hindi', name: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' },
  { code: 'Malayalam', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳' },
  { code: 'Spanish', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'French', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'German', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'Chinese', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'Japanese', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'Arabic', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'Russian', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'Portuguese', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'English', name: 'English', nativeName: 'English', flag: '🇬🇧' },
];

export const MODEL_EXPERT = 'gemini-3-pro-preview';
export const MODEL_PERFORMANCE = 'gemini-3-flash-preview';
export const THINKING_BUDGET_EXPERT = 10000;
