export type Language = 'English' | 'Hindi'

/**
 * Small hand-rolled i18n for the patient portal -- no translation
 * service is wired up (this is entirely static/pre-written content, not
 * machine translation), so only two kinds of text get a Hindi version:
 *
 * 1. Fixed UI chrome (`UI` below) -- page titles, labels, buttons.
 * 2. Known, fixed medical vocabulary and clinical-text blocks
 *    (`GRADE_TRANSLATIONS` / `CLINICAL_TEXT_HI`) -- the DR grade names,
 *    and the exact canned notes/prescription/diet text produced by the
 *    seed patient and DoctorReviewScreen's "Auto-fill Demo" templates.
 *
 * A doctor's freely-typed clinical notes are NOT translated -- there's
 * no translation backend, and silently fabricating a Hindi version of
 * arbitrary medical text a doctor actually wrote would be actively
 * unsafe. Custom text is shown exactly as written, in whichever
 * language the doctor typed it.
 */

export const GRADE_TRANSLATIONS: Record<string, string> = {
  'No DR': 'कोई डायबिटिक रेटिनोपैथी नहीं (No DR)',
  'Mild NPDR': 'हल्की डायबिटिक रेटिनोपैथी (Mild NPDR)',
  'Moderate NPDR': 'मध्यम डायबिटिक रेटिनोपैथी (Moderate NPDR)',
  'Severe NPDR': 'गंभीर डायबिटिक रेटिनोपैथी (Severe NPDR)',
  'Proliferative DR': 'प्रोलिफरेटिव डायबिटिक रेटिनोपैथी (Proliferative DR)',
  'Overridden Grade': 'डॉक्टर द्वारा बदला गया ग्रेड',
  Referable: 'रेफरल आवश्यक',
  Unknown: 'अज्ञात',
  Pending: 'लंबित',
}

export function translateGrade(grade: string | null | undefined, language: Language): string {
  if (!grade) return grade ?? ''
  if (language !== 'Hindi') return grade
  return GRADE_TRANSLATIONS[grade] ?? grade
}

// Keyed by the exact English string -- from WorkflowContext.tsx's
// SEED_PATIENTS and DoctorReviewScreen.tsx's applyTemplate(). Keep these
// two files and this dictionary in sync if either canned text changes.
const CLINICAL_TEXT_HI: Record<string, string> = {
  // Seed patient (Ramesh Kumar, Moderate NPDR)
  'Moderate non-proliferative diabetic retinopathy in both eyes. Microaneurysms and scattered haemorrhages noted, more pronounced in the right eye. No signs of macular edema on this visit. AI grading reviewed and confirmed.':
    'दोनों आंखों में मध्यम नॉन-प्रोलिफरेटिव डायबिटिक रेटिनोपैथी पाई गई है। माइक्रोएन्यूरिज्म और कुछ रक्तस्राव देखे गए हैं, जो दायीं आंख में थोड़ा अधिक हैं। इस जांच में मैक्युलर एडिमा के कोई लक्षण नहीं मिले। एआई की जांच की पुष्टि कर दी गई है।',
  'Nepafenac 0.1% Eye Drops - 1 drop twice daily for 2 weeks.':
    'नेपाफेनाक 0.1% आई ड्रॉप्स - 2 हफ्तों तक दिन में दो बार एक-एक बूंद डालें।',
  'Strictly avoid refined sugars and fried foods. Monitor fasting blood glucose daily. Increase leafy greens and high-fiber intake.':
    'रिफाइंड चीनी और तला हुआ भोजन बिल्कुल न लें। रोज़ाना खाली पेट ब्लड शुगर की जांच करें। हरी पत्तेदार सब्ज़ियां और फाइबर युक्त भोजन अधिक लें।',

  // DoctorReviewScreen "Auto-fill Demo" -- mild template
  'Mild non-proliferative diabetic retinopathy detected. AI findings verified. Microaneurysms noted in the macula region. No immediate surgical intervention required.':
    'हल्की नॉन-प्रोलिफरेटिव डायबिटिक रेटिनोपैथी पाई गई है। एआई के निष्कर्षों की पुष्टि कर दी गई है। मैक्युला क्षेत्र में माइक्रोएन्यूरिज्म देखे गए हैं। फिलहाल किसी सर्जरी की आवश्यकता नहीं है।',
  'Nepafenac 0.1% Eye Drops - 1 drop twice daily.':
    'नेपाफेनाक 0.1% आई ड्रॉप्स - दिन में दो बार एक-एक बूंद डालें।',
  'Strictly avoid refined sugars. Monitor blood glucose daily. High protein, low carbohydrate diet.':
    'रिफाइंड चीनी से पूरी तरह बचें। रोज़ाना ब्लड शुगर की जांच करें। उच्च प्रोटीन, कम कार्बोहाइड्रेट वाला आहार लें।',

  // DoctorReviewScreen "Auto-fill Demo" -- healthy template
  'Fundus appears completely healthy. No signs of diabetic retinopathy. AI confirmed. Retinal blood vessels normal.':
    'फंडस पूरी तरह स्वस्थ दिखाई दे रहा है। डायबिटिक रेटिनोपैथी का कोई लक्षण नहीं है। एआई ने इसकी पुष्टि की है। रेटिना की रक्त वाहिकाएं सामान्य हैं।',
  'No medication required.': 'किसी दवा की आवश्यकता नहीं है।',
  'Maintain current balanced diet to keep blood sugar stable.':
    'ब्लड शुगर को स्थिर रखने के लिए मौजूदा संतुलित आहार बनाए रखें।',
}

export function translateClinicalText(text: string | null | undefined, language: Language): string {
  if (!text) return text ?? ''
  if (language !== 'Hindi') return text
  return CLINICAL_TEXT_HI[text] ?? text
}

export const UI = {
  English: {
    home: {
      welcomeBack: (name: string) => `Welcome Back, ${name}`,
      subtitle: 'Your eye health dashboard',
      patientProfile: 'Patient Profile',
      age: 'Age',
      yrs: 'yrs',
      phone: 'Phone',
      lastVisit: 'Last Visit',
      today: 'Today',
      visitStatus: 'Visit Status',
      reportReadyTitle: 'Your Final Report is Ready',
      reportReadySubtitle: 'View your report or head to the Prescriptions tab for full details',
      view: 'View',
      steps: {
        Registered: 'Registered',
        'Scans Uploaded': 'Scans Uploaded',
        'Under Review': 'Under Review',
        'Report Ready': 'Report Ready',
      },
      stepStatus: { completed: 'Completed', inProgress: 'In Progress...', pending: 'Pending' },
    },
    scans: {
      title: 'My Scans & AI Analysis',
      subtitle: 'Your uploaded fundus images and AI-assisted insights',
      leftEye: 'Left Eye',
      rightEye: 'Right Eye',
      originalScan: 'Original Scan',
      aiHeatmap: 'AI Heatmap',
      classification: 'AI Classification',
      grade: 'Grade',
      probability: 'Probability',
      whatDoesThisMean: 'What does this mean?',
      noDrBadge: 'No DR',
      referableBadge: 'Referable',
      education: {
        healthy: {
          title: 'Your Eye Looks Healthy',
          desc: 'The AI did not find any signs of disease in this eye. The blood vessels and retina appear normal. Keep maintaining a healthy diet and getting regular checkups.',
        },
        retinopathy: {
          title: 'What is Diabetic Retinopathy?',
          desc: "Diabetic Retinopathy is a condition where high blood sugar causes damage to the tiny blood vessels in your eye's retina. The AI has flagged a region that may need the doctor's attention. Early detection means it can be managed well.",
        },
      },
    },
    prescriptions: {
      title: 'Prescriptions & Advice',
      subtitle: 'Your medical plan from your doctor',
      shareWhatsApp: 'Share on WhatsApp',
      downloadPdf: 'Download PDF',
      noReportTitle: 'No Final Report Yet',
      noReportBody: 'Your scans are still under review. Once the doctor finalizes the report, your prescriptions and advice will appear here.',
      clinicalNotes: "Doctor's Clinical Notes",
      readAloud: 'Read Aloud',
      stop: 'Stop',
      medications: 'Medications',
      dietLifestyle: 'Diet & Lifestyle',
      retinalSpecialist: 'Retinal Specialist',
      noNotesAvailable: 'No notes available.',
    },
  },
  Hindi: {
    home: {
      welcomeBack: (name: string) => `वापसी पर स्वागत है, ${name}`,
      subtitle: 'आपका आंखों की सेहत डैशबोर्ड',
      patientProfile: 'मरीज़ की जानकारी',
      age: 'उम्र',
      yrs: 'वर्ष',
      phone: 'फ़ोन नंबर',
      lastVisit: 'पिछली विज़िट',
      today: 'आज',
      visitStatus: 'विज़िट की स्थिति',
      reportReadyTitle: 'आपकी अंतिम रिपोर्ट तैयार है',
      reportReadySubtitle: 'अपनी रिपोर्ट देखें या पूरी जानकारी के लिए प्रिस्क्रिप्शन टैब पर जाएं',
      view: 'देखें',
      steps: {
        Registered: 'पंजीकृत',
        'Scans Uploaded': 'स्कैन अपलोड हुए',
        'Under Review': 'समीक्षा जारी है',
        'Report Ready': 'रिपोर्ट तैयार है',
      },
      stepStatus: { completed: 'पूर्ण', inProgress: 'प्रगति में...', pending: 'लंबित' },
    },
    scans: {
      title: 'मेरे स्कैन और एआई विश्लेषण',
      subtitle: 'आपकी अपलोड की गई फंडस छवियां और एआई से मिली जानकारी',
      leftEye: 'बायीं आंख',
      rightEye: 'दायीं आंख',
      originalScan: 'मूल स्कैन',
      aiHeatmap: 'एआई हीटमैप',
      classification: 'एआई वर्गीकरण',
      grade: 'ग्रेड',
      probability: 'संभावना',
      whatDoesThisMean: 'इसका क्या मतलब है?',
      noDrBadge: 'कोई डीआर नहीं',
      referableBadge: 'रेफरल आवश्यक',
      education: {
        healthy: {
          title: 'आपकी आंख स्वस्थ दिखाई देती है',
          desc: 'एआई को इस आंख में किसी बीमारी के लक्षण नहीं मिले। रक्त वाहिकाएं और रेटिना सामान्य दिखाई दे रहे हैं। स्वस्थ आहार बनाए रखें और नियमित जांच कराते रहें।',
        },
        retinopathy: {
          title: 'डायबिटिक रेटिनोपैथी क्या है?',
          desc: 'डायबिटिक रेटिनोपैथी एक ऐसी स्थिति है जिसमें ज़्यादा ब्लड शुगर के कारण आंख के रेटिना की छोटी रक्त वाहिकाओं को नुकसान पहुंचता है। एआई ने एक ऐसा क्षेत्र चिन्हित किया है जिस पर डॉक्टर का ध्यान देना ज़रूरी हो सकता है। समय पर पता चलने से इसे अच्छी तरह संभाला जा सकता है।',
        },
      },
    },
    prescriptions: {
      title: 'प्रिस्क्रिप्शन और सलाह',
      subtitle: 'आपके डॉक्टर की ओर से आपकी चिकित्सा योजना',
      shareWhatsApp: 'व्हाट्सएप पर शेयर करें',
      downloadPdf: 'पीडीएफ डाउनलोड करें',
      noReportTitle: 'अभी तक अंतिम रिपोर्ट नहीं है',
      noReportBody: 'आपके स्कैन अभी भी समीक्षा में हैं। डॉक्टर द्वारा रिपोर्ट पूरी करने के बाद, आपकी दवाइयां और सलाह यहां दिखाई देंगी।',
      clinicalNotes: 'डॉक्टर के क्लिनिकल नोट्स',
      readAloud: 'ज़ोर से पढ़ें',
      stop: 'रोकें',
      medications: 'दवाइयां',
      dietLifestyle: 'आहार और जीवनशैली',
      retinalSpecialist: 'रेटिना विशेषज्ञ',
      noNotesAvailable: 'कोई नोट उपलब्ध नहीं है।',
    },
  },
} as const
