import type { Language } from './i18n'

/** Patient Settings page strings (kept out of `UI` in i18n.ts so the page's
 *  many labels don't bloat the per-page blocks there). */
export interface SettingsStrings {
  title: string; subtitle: string
  profile: string; fullName: string; patientId: string; phone: string; age: string
  languageTitle: string; languageDesc: string
  voiceTitle: string; voiceDesc: string; voiceLang: string; voiceAuto: string; voiceEnglish: string; voiceHindi: string
  speed: string; slow: string; normal: string; fast: string; testVoice: string; stopVoice: string; testSentence: string
  accessTitle: string; largeText: string; largeTextDesc: string; contrast: string; contrastDesc: string
  shareTitle: string; attachPdf: string; attachPdfDesc: string; familyNumber: string
  familyToggle: string; familyInvalid: string
  privacyTitle: string; downloadData: string; downloadDataDesc: string
  consent: string; consentDesc: string
  deleteTitle: string; deleteDesc: string; deleteBtn: string; deleteConfirm: string; deleteCancel: string
  deletePending: string; deleteWithdraw: string
  sessionTitle: string; signOut: string
  noVoice: string
}

export const SETTINGS_UI: Record<Language, SettingsStrings> = {
  English: {
    title: 'Settings', subtitle: 'Personalise the portal and manage your data',
    profile: 'Your details', fullName: 'Full name', patientId: 'Patient ID', phone: 'Phone number', age: 'Age',
    languageTitle: 'Language', languageDesc: 'Used across the whole portal.',
    voiceTitle: 'Read-aloud', voiceDesc: "How your doctor's notes are spoken.", voiceLang: 'Voice language',
    voiceAuto: 'Same as portal language', voiceEnglish: 'English', voiceHindi: 'Hindi',
    speed: 'Speaking speed', slow: 'Slow', normal: 'Normal', fast: 'Fast', testVoice: 'Test voice', stopVoice: 'Stop',
    testSentence: 'This is how your reports will be read aloud.',
    accessTitle: 'Display', largeText: 'Large text', largeTextDesc: 'Make all text in the portal bigger.',
    contrast: 'High contrast', contrastDesc: 'Darker background and brighter text for easier reading.',
    shareTitle: 'Sharing reports', attachPdf: 'Attach the PDF when sharing on WhatsApp',
    attachPdfDesc: 'When off, only the text summary is shared.',
    familyNumber: "Family member's WhatsApp number",
    familyToggle: 'Share to this number by default', familyInvalid: 'Enter a valid phone number.',
    privacyTitle: 'Privacy & data', downloadData: 'Download my data', downloadDataDesc: 'A file with your details, report and settings.',
    consent: 'Help improve the screening AI', consentDesc: 'Allow my anonymised scans to be used to improve the model. Off by default.',
    deleteTitle: 'Delete my account', deleteDesc: 'Ask the clinic to permanently delete your record and scans.',
    deleteBtn: 'Request deletion', deleteConfirm: 'Yes, request deletion', deleteCancel: 'Cancel',
    deletePending: 'Deletion requested on', deleteWithdraw: 'Withdraw request',
    sessionTitle: 'Session', signOut: 'Sign out',
    noVoice: 'No voice for this language is installed on this device.',
  },
  Hindi: {
    title: 'सेटिंग्स', subtitle: 'पोर्टल को अपनी पसंद के अनुसार बदलें और अपना डेटा प्रबंधित करें',
    profile: 'आपकी जानकारी', fullName: 'पूरा नाम', patientId: 'मरीज़ आईडी', phone: 'फ़ोन नंबर', age: 'उम्र',
    languageTitle: 'भाषा', languageDesc: 'पूरे पोर्टल में इस्तेमाल होगी।',
    voiceTitle: 'बोलकर सुनाएँ', voiceDesc: 'डॉक्टर के नोट्स कैसे पढ़े जाएँ।', voiceLang: 'आवाज़ की भाषा',
    voiceAuto: 'पोर्टल की भाषा जैसी', voiceEnglish: 'अंग्रेज़ी', voiceHindi: 'हिंदी',
    speed: 'बोलने की गति', slow: 'धीमी', normal: 'सामान्य', fast: 'तेज़', testVoice: 'आवाज़ जाँचें', stopVoice: 'रोकें',
    testSentence: 'आपकी रिपोर्ट इस तरह पढ़कर सुनाई जाएगी।',
    accessTitle: 'डिस्प्ले', largeText: 'बड़े अक्षर', largeTextDesc: 'पोर्टल के सभी अक्षर बड़े करें।',
    contrast: 'हाई कॉन्ट्रास्ट', contrastDesc: 'आसानी से पढ़ने के लिए गहरी पृष्ठभूमि और चमकीले अक्षर।',
    shareTitle: 'रिपोर्ट शेयर करना', attachPdf: 'व्हाट्सएप पर शेयर करते समय PDF जोड़ें',
    attachPdfDesc: 'बंद होने पर केवल टेक्स्ट सारांश शेयर होगा।',
    familyNumber: 'परिवार के सदस्य का व्हाट्सएप नंबर',
    familyToggle: 'डिफ़ॉल्ट रूप से इसी नंबर पर भेजें', familyInvalid: 'कृपया सही फ़ोन नंबर लिखें।',
    privacyTitle: 'गोपनीयता और डेटा', downloadData: 'मेरा डेटा डाउनलोड करें', downloadDataDesc: 'आपकी जानकारी, रिपोर्ट और सेटिंग्स वाली फ़ाइल।',
    consent: 'स्क्रीनिंग AI को बेहतर बनाने में मदद करें', consentDesc: 'मॉडल सुधारने के लिए मेरे गुमनाम स्कैन इस्तेमाल करने दें। डिफ़ॉल्ट रूप से बंद।',
    deleteTitle: 'मेरा खाता हटाएँ', deleteDesc: 'क्लिनिक से अपना रिकॉर्ड और स्कैन हमेशा के लिए हटाने का अनुरोध करें।',
    deleteBtn: 'हटाने का अनुरोध करें', deleteConfirm: 'हाँ, अनुरोध भेजें', deleteCancel: 'रद्द करें',
    deletePending: 'हटाने का अनुरोध किया गया:', deleteWithdraw: 'अनुरोध वापस लें',
    sessionTitle: 'सेशन', signOut: 'साइन आउट',
    noVoice: 'इस डिवाइस पर इस भाषा की आवाज़ इंस्टॉल नहीं है।',
  },
}
