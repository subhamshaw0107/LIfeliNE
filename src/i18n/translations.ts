export type LanguageCode = 'en' | 'hi' | 'bn';

export const translations: Record<LanguageCode, Record<string, string>> = {
  en: {
    // App Header & Meta
    appName: 'LifeLINE',
    appTagline: 'Offline Emergency Rescue Network',
    language: 'Language',
    
    // Navigation Tabs
    navHome: 'Home',
    navDashboard: 'Triage Dashboard',
    navMap: 'Rescue Map',
    navRadar: 'Mesh Radar',
    navChat: 'Offline Chat',
    navProfile: 'Account',

    // Role & Auth
    authTitle: 'Emergency Registration',
    authSubtitle: 'Choose your role to continue. Works 100% offline.',
    enterName: 'Full Name',
    enterNamePlaceholder: 'Enter your name...',
    enterPhone: 'Phone Number (Optional)',
    enterPhonePlaceholder: 'Mobile number for rescue contact...',
    roleVictimTitle: 'I Need Help',
    roleVictimDesc: 'Civilian in distress / Emergency mode',
    roleRescueTitle: 'I Am a Rescuer',
    roleRescueDesc: 'First responder / Search & Rescue team',
    continueBtn: 'Continue to App',
    switchRole: 'Switch Role',

    // Victim Home Page
    victimHeaderTitle: 'Emergency Response System',
    victimStatusOk: 'Device Active & Connected to Mesh',
    sosButtonLabel: 'PRESS FOR EMERGENCY HELP',
    sosButtonSubtext: 'Tap to broadcast your location & distress signal',
    sosActiveStatus: 'EMERGENCY BROADCAST ACTIVE',
    sosActiveSubtext: 'Relaying distress packets to nearby mesh devices...',
    markSafeBtn: 'I Am Safe Now (Cancel SOS)',
    quickCategoriesTitle: 'Quick Category SOS',
    catMedical: 'Medical Emergency',
    catTrapped: 'Trapped in Debris',
    catHazard: 'Fire / Hazard',
    catSafe: 'I Am Safe',

    // SOS Progress Tracker
    trackerTitle: 'Emergency Signal Timeline',
    step1: 'Signal Broadcasted',
    step1Sub: 'Sent from your phone',
    step2: 'Relayed via Mesh',
    step2Sub: 'Passed through nearby devices',
    step3: 'Acknowledged by Rescuers',
    step3Sub: 'Rescue team notified',

    // Responder Dashboard
    rescueHeaderTitle: 'Rescue Response Command',
    statCritical: 'Critical Alerts',
    statPending: 'Pending Triage',
    statRescued: 'Rescued',
    filterAll: 'All Alerts',
    filterRedZone: 'Red Zone Danger',
    filterClaimed: 'My Claimed Tasks',
    claimBtn: 'Claim & Dispatch',
    markRescuedBtn: 'Mark as Rescued',
    viewOnMap: 'View Location on Map',
    noAlerts: 'No emergency alerts reported in this area.',

    // Tactical Map
    mapHeader: 'Disaster Tactical Map',
    mapOfflineNotice: 'Offline Map Mode (Cached Tiles & Mesh Coordinates)',
    legendVictims: 'Victims in Distress',
    legendRescuers: 'Rescue Teams',

    // Offline Chat
    chatHeader: 'Offline Emergency Chat',
    chatNotice: 'Messages are broadcasted directly over Bluetooth Mesh (No Internet Required)',
    presetHeader: 'Tap to Broadcast Emergency Message:',
    msgHelp: 'I need help.',
    msgTrapped: 'We are trapped.',
    msgMedical: 'Medical help needed.',
    msgEvac: 'We need evacuation.',
    msgInjured: 'People are injured.',
    msgWater: 'We need food and water.',
    msgBlocked: 'Road is blocked.',
    msgSafe: 'I am safe.',
    customMsgPlaceholder: 'Type a custom message...',
    sendBtn: 'Send',
    sentHistoryHeader: 'Sent Emergency Messages',

    // Mesh Radar
    radarHeader: 'Bluetooth Mesh Network',
    radarSubtitle: 'Nearby active relay nodes in range',
    connectedPeers: 'Connected Nearby Devices',
    hopCount: 'Distance / Hops',
    signalStrength: 'Signal Strength',

    // Hardware Status Strip
    statusMeshReady: 'Mesh Active',
    statusGpsActive: 'GPS Locked',
    statusInternetOff: 'No Internet (Mesh Mode)',
    statusInternetOn: 'Internet Connected',
    batteryLabel: 'Battery'
  },
  hi: {
    // App Header & Meta
    appName: 'लाइफलाइन',
    appTagline: 'ऑफ़लाइन आपातकालीन बचाव नेटवर्क',
    language: 'भाषा',
    
    // Navigation Tabs
    navHome: 'होम',
    navDashboard: 'ट्रियाज डैशबोर्ड',
    navMap: 'बचाव मानचित्र',
    navRadar: 'मेश रडार',
    navChat: 'ऑफ़लाइन चैट',
    navProfile: 'प्रोफ़ाइल',

    // Role & Auth
    authTitle: 'आपातकालीन पंजीकरण',
    authSubtitle: 'आगे बढ़ने के लिए अपनी भूमिका चुनें। 100% ऑफ़लाइन काम करता है।',
    enterName: 'पूरा नाम',
    enterNamePlaceholder: 'अपना नाम दर्ज करें...',
    enterPhone: 'फोन नंबर (वैकल्पिक)',
    enterPhonePlaceholder: 'बचाव संपर्क के लिए मोबाइल नंबर...',
    roleVictimTitle: 'मुझे मदद चाहिए',
    roleVictimDesc: 'संकट में नागरिक / आपातकालीन मोड',
    roleRescueTitle: 'मैं बचावकर्ता हूँ',
    roleRescueDesc: 'प्रथम प्रतिक्रियाकर्ता / खोज एवं बचाव दल',
    continueBtn: 'ऐप में आगे बढ़ें',
    switchRole: 'भूमिका बदलें',

    // Victim Home Page
    victimHeaderTitle: 'आपातकालीन प्रतिक्रिया प्रणाली',
    victimStatusOk: 'डिवाइस सक्रिय और मेश से जुड़ा है',
    sosButtonLabel: 'आपातकालीन मदद के लिए दबाएं',
    sosButtonSubtext: 'अपना स्थान और संकट का संकेत भेजने के लिए दबाएं',
    sosActiveStatus: 'आपातकालीन प्रसारण सक्रिय है',
    sosActiveSubtext: 'पास के मेश उपकरणों को संकेत भेजा जा रहा है...',
    markSafeBtn: 'मैं अब सुरक्षित हूँ (SOS रद्द करें)',
    quickCategoriesTitle: 'त्वरित श्रेणी SOS',
    catMedical: 'चिकित्सा आपातकाल',
    catTrapped: 'मलबे में फंसे हैं',
    catHazard: 'आग / खतरा',
    catSafe: 'मैं सुरक्षित हूँ',

    // SOS Progress Tracker
    trackerTitle: 'आपातकालीन संकेत समय-रेखा',
    step1: 'संकेत प्रसारित',
    step1Sub: 'आपके फोन से भेजा गया',
    step2: 'मेश द्वारा प्रसारित',
    step2Sub: 'आस-पास के उपकरणों से गुजरा',
    step3: 'बचाव दल द्वारा स्वीकारित',
    step3Sub: 'बचाव दल को सूचित किया गया',

    // Responder Dashboard
    rescueHeaderTitle: 'बचाव प्रतिक्रिया कमांड',
    statCritical: 'गंभीर अलर्ट',
    statPending: 'लंबित मामले',
    statRescued: 'सुरक्षित बचाए गए',
    filterAll: 'सभी अलर्ट',
    filterRedZone: 'खतरा क्षेत्र (रेड ज़ोन)',
    filterClaimed: 'मेरे स्वीकारित कार्य',
    claimBtn: 'स्वीकार करें और जाएं',
    markRescuedBtn: 'सुरक्षित मार्क करें',
    viewOnMap: 'मानचित्र पर देखें',
    noAlerts: 'इस क्षेत्र में कोई आपातकालीन अलर्ट नहीं है।',

    // Tactical Map
    mapHeader: 'आपदा रणनीतिक मानचित्र',
    mapOfflineNotice: 'ऑफ़लाइन मानचित्र मोड (कैश किए गए नक्शे और मेश निर्देशांक)',
    legendVictims: 'संकट में पीड़ित',
    legendRescuers: 'बचाव दल',

    // Offline Chat
    chatHeader: 'ऑफ़लाइन आपातकालीन चैट',
    chatNotice: 'संदेश सीधे ब्लूटूथ मेश द्वारा भेजे जाते हैं (इंटरनेट आवश्यक नहीं)',
    presetHeader: 'आपातकालीन संदेश भेजने के लिए दबाएं:',
    msgHelp: 'मुझे मदद चाहिए।',
    msgTrapped: 'हम फंसे हुए हैं।',
    msgMedical: 'चिकित्सा सहायता की आवश्यकता है।',
    msgEvac: 'हमें बाहर निकालने की आवश्यकता है।',
    msgInjured: 'लोग घायल हैं।',
    msgWater: 'हमें भोजन और पानी चाहिए।',
    msgBlocked: 'रास्ता बंद है।',
    msgSafe: 'मैं सुरक्षित हूँ।',
    customMsgPlaceholder: 'संदेश लिखें...',
    sendBtn: 'भेजें',
    sentHistoryHeader: 'भेजे गए आपातकालीन संदेश',

    // Mesh Radar
    radarHeader: 'ब्लूटूथ मेश नेटवर्क',
    radarSubtitle: 'सीमा में सक्रिय रिले उपकरण',
    connectedPeers: 'जुड़े हुए आस-पास के उपकरण',
    hopCount: 'दूरी / हॉप्स',
    signalStrength: 'सिग्नल की क्षमता',

    // Hardware Status Strip
    statusMeshReady: 'मेश सक्रिय',
    statusGpsActive: 'GPS सक्रिय',
    statusInternetOff: 'इंटरनेट नहीं (मेश मोड)',
    statusInternetOn: 'इंटरनेट कनेक्टेड',
    batteryLabel: 'बैटरी'
  },
  bn: {
    // App Header & Meta
    appName: 'লাইফলাইন',
    appTagline: 'অফলাইন জরুরি উদ্ধার নেটওয়ার্ক',
    language: 'ভাষা',
    
    // Navigation Tabs
    navHome: 'হোম',
    navDashboard: 'ট্রিয়েজ ড্যাশবোর্ড',
    navMap: 'উদ্ধার ম্যাপ',
    navRadar: 'মেশ রাডার',
    navChat: 'অফলাইন চ্যাট',
    navProfile: 'প্রোফাইল',

    // Role & Auth
    authTitle: 'জরুরি নিবন্ধন',
    authSubtitle: 'এগিয়ে যেতে আপনার ভূমিকা বেছে নিন। ১০০% অফলাইনে কাজ করে।',
    enterName: 'সম্পূর্ণ নাম',
    enterNamePlaceholder: 'আপনার নাম লিখুন...',
    enterPhone: 'ফোন নম্বর (ঐচ্ছিক)',
    enterPhonePlaceholder: 'যোগাযোগের জন্য মোবাইল নম্বর...',
    roleVictimTitle: 'আমার সাহায্য দরকার',
    roleVictimDesc: 'বিপদগ্রস্ত নাগরিক / জরুরি মোড',
    roleRescueTitle: 'আমি একজন উদ্ধারকারী',
    roleRescueDesc: 'ফার্স্ট রেসপন্ডার / অনুসন্ধান ও উদ্ধারকারী দল',
    continueBtn: 'অ্যাপে এগিয়ে যান',
    switchRole: 'ভূমিকা পরিবর্তন করুন',

    // Victim Home Page
    victimHeaderTitle: 'জরুরি সাড়া সিস্টেম',
    victimStatusOk: 'ডিভাইস সক্রিয় এবং মেশ নেটওয়ার্কে সংযুক্ত',
    sosButtonLabel: 'জরুরি সাহায্যের জন্য চাপুন',
    sosButtonSubtext: 'আপনার অবস্থান ও সংকেত পাঠাতে একবার চাপুন',
    sosActiveStatus: 'জরুরি সম্প্রচার সক্রিয়',
    sosActiveSubtext: 'কাছের মেশ ডিভাইসে সংকেত পাঠানো হচ্ছে...',
    markSafeBtn: 'আমি এখন নিরাপদ (SOS বাতিল করুন)',
    quickCategoriesTitle: 'দ্রুত ক্যাটাগরি SOS',
    catMedical: 'চিকিৎসা জরুরি',
    catTrapped: 'ধ্বংসাবশেষে আটকে আছি',
    catHazard: 'আগুন / বিপদ',
    catSafe: 'আমি নিরাপদ',

    // SOS Progress Tracker
    trackerTitle: 'জরুরি সংকেতের সময়রেখা',
    step1: 'সংকেত সম্প্রচারিত',
    step1Sub: 'আপনার ফোন থেকে পাঠানো হয়েছে',
    step2: 'মেশ দ্বারা প্রবাহিত',
    step2Sub: 'কাছের ডিভাইসের মাধ্যমে গেছে',
    step3: 'উদ্ধারকারী দল দ্বারা স্বীকৃত',
    step3Sub: 'উদ্ধারকারী দলকে জানানো হয়েছে',

    // Responder Dashboard
    rescueHeaderTitle: 'উদ্ধার সাড়া কমান্ড',
    statCritical: 'গুরুত্বপূর্ণ সতর্কতা',
    statPending: 'পেন্ডিং ট্রিয়েজ',
    statRescued: 'উদ্ধারকৃত',
    filterAll: 'সব সতর্কতা',
    filterRedZone: 'বিপদ অঞ্চল (রেড জোন)',
    filterClaimed: 'আমার গৃহীত কাজ',
    claimBtn: 'গ্রহণ করুন ও যাত্রা শুরু করুন',
    markRescuedBtn: 'উদ্ধারকৃত চিহ্নিত করুন',
    viewOnMap: 'ম্যাপে দেখুন',
    noAlerts: 'এই এলাকায় কোনো জরুরি সতর্কতা নেই।',

    // Tactical Map
    mapHeader: 'দুর্যোগ স্ট্র্যাটেজিক ম্যাপ',
    mapOfflineNotice: 'অফলাইন ম্যাপ মোড (ক্যাশ করা ম্যাপ ও মেশ স্থানাঙ্ক)',
    legendVictims: 'বিপদগ্রস্ত মানুষ',
    legendRescuers: 'উদ্ধারকারী দল',

    // Offline Chat
    chatHeader: 'অফলাইন জরুরি চ্যাট',
    chatNotice: 'বার্তাগুলো ব্লুটুথ মেশের মাধ্যমে সরাসরি পাঠানো হয় (ইন্টারনেট প্রয়োজন নেই)',
    presetHeader: 'জরুরি বার্তা পাঠাতে চাপুন:',
    msgHelp: 'আমার সাহায্য দরকার।',
    msgTrapped: 'আমরা আটকে আছি।',
    msgMedical: 'চিকিৎসা সহায়তা প্রয়োজন।',
    msgEvac: 'আমাদের স্থানান্তরিত করা দরকার।',
    msgInjured: 'মানুষ আহত হয়েছে।',
    msgWater: 'আমাদের খাবার ও জল প্রয়োজন।',
    msgBlocked: 'রাস্তা বন্ধ।',
    msgSafe: 'আমি নিরাপদ।',
    customMsgPlaceholder: 'বার্তা লিখুন...',
    sendBtn: 'পাঠান',
    sentHistoryHeader: 'পাঠানো জরুরি বার্তা',

    // Mesh Radar
    radarHeader: 'ব্লুটুথ মেশ নেটওয়ার্ক',
    radarSubtitle: 'সীমানার মধ্যে সক্রিয় রিলে ডিভাইস',
    connectedPeers: 'সংযুক্ত কাছের ডিভাইস',
    hopCount: 'দূরত্ব / হপস',
    signalStrength: 'সিগন্যালের শক্তি',

    // Hardware Status Strip
    statusMeshReady: 'মেশ সক্রিয়',
    statusGpsActive: 'GPS সক্রিয়',
    statusInternetOff: 'ইন্টারনেট নেই (মেশ মোড)',
    statusInternetOn: 'ইন্টারনেট সংযুক্ত',
    batteryLabel: 'ব্যাটারি'
  }
};
