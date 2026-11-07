/**
 * AS Financial Services and Solutions
 * Central content configuration.
 *
 * IMPORTANT — PLACEHOLDERS
 * Any field marked `verified: false` is a placeholder and must be replaced
 * with confirmed business information before the site goes live.
 * Interest rates and fees are indicative samples, not live lender offers.
 */

export const business = {
  name: "AS Financial Services and Solutions",
  legalName: "AS FINANCIAL SERVICES AND SOLUTIONS",
  shortName: "AS Financial",
  tagline: "Your Goals, Our Solutions",
  slogan: "Your Goals, Our Solutions",
  city: "Hyderabad",
  region: "Telangana, India",
  addressLine: "Panchavati Colony Road No. 1, Medipally, Hyderabad, Telangana 500098, India",
  addressNote: "Panchavati Colony Road No. 1, Medipally, Hyderabad, Telangana 500098.",
  mapUrl: "https://www.google.com/maps/dir/?api=1&destination=Panchavati+Colony+Road+No.+1%2C+Medipally%2C+Hyderabad%2C+Telangana+500098%2C+India",
  mapEmbedUrl:
    "https://www.google.com/maps?q=Panchavati+Colony+Road+No.+1,+Medipally,+Hyderabad,+Telangana+500098,+India&output=embed",
  phone: {
    display: "+91 91827 03079",
    tel: "+919182703079",
    verified: true,
  },
  whatsapp: {
    display: "+91 91827 03079",
    number: "919182703079",
    verified: true,
  },
  email: {
    display: "asfinancialservicesandsolution@gmail.com",
    address: "asfinancialservicesandsolution@gmail.com",
    verified: true,
  },
  hours: "Contact for availability",
  hoursNote: "Please call or message to confirm a convenient time.",
};

export const site = {
  siteName: "AS Financial Services and Solutions",
  baseUrl: "https://example.com",
  themeColor: "#263D59",
  locale: "en_IN",
  // Change this single value to update the response-time claim everywhere.
  processHours: 48,
  banksLastUpdated: "07 November 2026",
  ratesDisclaimer:
    "Interest rates, loan amounts and fees shown are indicative samples for demonstration purposes only. They are not offers or quotes from any bank or NBFC. Actual rates and charges depend on the lender, applicant profile, credit assessment, property and prevailing policy. Please confirm current terms directly with the lender before applying.",
  reviewDisclaimer:
    "We only publish customer reviews that can be verified from our Google Business Profile. No reviews have been imported into this build yet.",
};

export const navigationLinks = [
  { label: "Home", href: "index.html", key: "home" },
  { label: "About", href: "about.html", key: "about" },
  { label: "Services", href: "services.html", key: "services" },
  { label: "Home Loans", href: "home-loans.html", key: "loans" },
  { label: "Lenders", href: "banks.html", key: "banks" },
  { label: "EMI Calculator", href: "index.html#emi-calculator", key: "emi" },
  { label: "Contact", href: "contact.html", key: "contact" },
];

export const trustHighlights = [
  {
    icon: "user-round-check",
    title: "Personalised Assistance",
    text: "Guidance shaped around your goals, documents and next steps.",
    tone: "powder",
  },
  {
    icon: "sparkles",
    title: "Multiple Service Options",
    text: "Support across loans, mortgage needs, funding enquiries and insurance.",
    tone: "lavender",
  },
  {
    icon: "files",
    title: "Documentation Guidance",
    text: "A clear checklist and support at every stage of your enquiry.",
    tone: "peach",
  },
  {
    icon: "headset",
    title: "Dedicated Support",
    text: "One point of contact who keeps your questions moving forward.",
    tone: "sage",
  },
];

export const whyUs = [
  {
    number: "01",
    icon: "scale",
    title: "Find the Right Bank",
    text: "We help you look beyond the headline rate — considering eligibility, tenure, fees and the overall cost of borrowing.",
    image: "assets/images/why-find-bank.jpg",
    alt: "Contemporary white house with a pool and warm timber ceiling",
  },
  {
    number: "02",
    icon: "file-check-2",
    title: "Hassle-Free Documentation",
    text: "From income proof to property papers, we help you understand what is needed and prepare a complete application.",
    image: "assets/images/why-documents.jpg",
    alt: "A financial document being reviewed and signed",
  },
  {
    number: "03",
    icon: "compass",
    title: "Personalised Financial Guidance",
    text: "Practical, patient conversations about affordability, repayment and the trade-offs that matter to your family.",
    image: "assets/images/why-guidance.jpg",
    alt: "Two professionals shaking hands after a consultation",
  },
];

/**
 * Indicative bank data — sample values only.
 * `tone` maps to the monogram tile colour in components.css.
 */
export const banks = [
  {
    id: "sbi",
    name: "State Bank of India",
    shortName: "SBI",
    wordmark: "SBI",
    type: "Public",
    rate: "8.50",
    emiPerLakh: "₹868",
    amountRange: "₹5 L – ₹5 Cr",
    processingFee: "0.25% – 0.50% + GST",
    tenure: "Up to 30 years",
    updated: "07 Nov 2026",
    tone: "powder",
    logo: ""
  },
  {
    id: "hdfc",
    name: "HDFC Bank",
    shortName: "HDFC",
    wordmark: "HDFC",
    type: "Private",
    rate: "8.75",
    emiPerLakh: "₹884",
    amountRange: "₹5 L – ₹5 Cr",
    processingFee: "0.30% – 0.50% + GST",
    tenure: "Up to 30 years",
    updated: "07 Nov 2026",
    tone: "lavender",
    logo: ""
  },
  {
    id: "icici",
    name: "ICICI Bank",
    shortName: "ICICI",
    wordmark: "ICICI",
    type: "Private",
    rate: "8.75",
    emiPerLakh: "₹884",
    amountRange: "₹5 L – ₹5 Cr",
    processingFee: "0.25% – 0.50% + GST",
    tenure: "Up to 30 years",
    updated: "07 Nov 2026",
    tone: "peach",
    logo: ""
  },
  {
    id: "axis",
    name: "Axis Bank",
    shortName: "AXIS",
    wordmark: "Axis",
    type: "Private",
    rate: "8.85",
    emiPerLakh: "₹891",
    amountRange: "₹5 L – ₹5 Cr",
    processingFee: "0.50% – 1.00% + GST",
    tenure: "Up to 30 years",
    updated: "07 Nov 2026",
    tone: "sage",
    logo: ""
  },
  {
    id: "pnb",
    name: "Punjab National Bank",
    shortName: "PNB",
    wordmark: "PNB",
    type: "Public",
    rate: "8.55",
    emiPerLakh: "₹871",
    amountRange: "₹5 L – ₹2 Cr",
    processingFee: "0.25% – 0.50% + GST",
    tenure: "Up to 30 years",
    updated: "07 Nov 2026",
    tone: "peach",
    logo: ""
  },
  {
    id: "bob",
    name: "Bank of Baroda",
    shortName: "BOB",
    wordmark: "BoB",
    type: "Public",
    rate: "8.60",
    emiPerLakh: "₹875",
    amountRange: "₹5 L – ₹2 Cr",
    processingFee: "0.25% – 0.50% + GST",
    tenure: "Up to 30 years",
    updated: "07 Nov 2026",
    tone: "powder",
    logo: ""
  },
  {
    id: "union",
    name: "Union Bank of India",
    shortName: "UBI",
    wordmark: "Union Bank",
    type: "Public",
    rate: "8.65",
    emiPerLakh: "₹878",
    amountRange: "₹5 L – ₹2 Cr",
    processingFee: "0.25% – 0.50% + GST",
    tenure: "Up to 30 years",
    updated: "07 Nov 2026",
    tone: "sage",
    logo: ""
  },
  {
    id: "canara",
    name: "Canara Bank",
    shortName: "CANARA",
    wordmark: "Canara",
    type: "Public",
    rate: "8.60",
    emiPerLakh: "₹875",
    amountRange: "₹5 L – ₹2 Cr",
    processingFee: "0.25% – 0.50% + GST",
    tenure: "Up to 30 years",
    updated: "07 Nov 2026",
    tone: "lavender",
    logo: ""
  },
  {
    id: "lic",
    name: "LIC Housing Finance",
    shortName: "LIC HFL",
    wordmark: "LIC HFL",
    type: "Housing Finance",
    rate: "8.90",
    emiPerLakh: "₹894",
    amountRange: "₹5 L – ₹5 Cr",
    processingFee: "0.25% – 0.50% + GST",
    tenure: "Up to 30 years",
    updated: "07 Nov 2026",
    tone: "ivory",
    logo: ""
  }
];

export const services = [
  {
    id: "personal-loans",
    title: "Personal Loans",
    tag: "Planned expenses",
    icon: "wallet",
    tone: "amber",
    image: "assets/images/service-personal.jpg",
    alt: "Family at home discussing plans",
    description:
      "Guidance for personal borrowing needs, with a clear discussion of eligibility, documentation and repayment considerations.",
    details: [
      "Help understanding lender eligibility requirements",
      "Support with application and documentation",
      "Discussion of repayment options and obligations",
      "Final terms and approval are decided by the lender",
    ],
    cta: { label: "Enquire now", href: "contact.html?service=Personal+Loan" },
  },
  {
    id: "home-loans",
    title: "Home Loans",
    tag: "Buy or build",
    icon: "house",
    tone: "sky",
    image: "assets/images/service-home-loan.jpg",
    alt: "Modern white home with full-height glass walls and a pool",
    description:
      "Support for buying, building or financing a home, including help comparing options and preparing documents.",
    details: [
      "Purchase, construction or property-related financing guidance",
      "Comparison of lender options where available",
      "Documentation checklist and application support",
      "Eligibility and sanction are subject to lender assessment",
    ],
    cta: { label: "Explore home loans", href: "home-loans.html" },
  },
  {
    id: "business-loans",
    title: "Business Loans",
    tag: "Business finance",
    icon: "briefcase-business",
    tone: "emerald",
    image: "assets/images/service-business.jpg",
    alt: "Team collaborating around a table in a bright office",
    description:
      "Assistance for business funding enquiries, helping you understand documentation and suitable lender pathways.",
    details: [
      "Working capital or business funding enquiries",
      "Guidance on financial and business documents",
      "Discussion of secured or unsecured options, as applicable",
      "Approval, amount and terms depend on lender policy",
    ],
    cta: { label: "Talk business", href: "contact.html?service=Business+Loan" },
  },
  {
    id: "education-loans",
    title: "Education Loans",
    tag: "Education support",
    icon: "graduation-cap",
    tone: "violet",
    image: "assets/images/service-education.jpg",
    alt: "Children learning together in a bright classroom",
    description:
      "Help exploring education loan options, including what documents and eligibility factors lenders may review.",
    details: [
      "Guidance for student or education-related funding enquiries",
      "Overview of common lender documentation requirements",
      "Support in preparing a clear application",
      "Course, institution and lender criteria apply",
    ],
    cta: { label: "Ask about education loans", href: "contact.html?service=Education+Loan" },
  },
  {
    id: "mortgage-loans",
    title: "Mortgage Loans",
    tag: "Property-backed",
    icon: "building-2",
    tone: "slate",
    image: "assets/images/service-lap.jpg",
    alt: "Contemporary home with landscaped entrance",
    description:
      "Guidance for mortgage or property-backed loan enquiries, with attention to documentation and lender requirements.",
    details: [
      "Property-backed loan enquiries and documentation guidance",
      "Discussion of valuation, title and eligibility considerations",
      "Help understanding charges and repayment terms",
      "Subject to property verification and lender approval",
    ],
    cta: { label: "Discuss mortgage options", href: "contact.html?service=Mortgage+Loan" },
  },
  {
    id: "private-funds",
    title: "Private Funds",
    tag: "Funding support",
    icon: "hand-coins",
    tone: "sand",
    image: "assets/images/consultation.jpg",
    alt: "Financial consultation documents and discussion",
    description:
      "Initial guidance for private funding requirements, helping you clarify the need, documentation and next steps.",
    details: [
      "Discussion of funding requirement and purpose",
      "Help organising relevant documents and information",
      "Clear explanation of available next steps",
      "Terms, availability and suitability depend on the specific arrangement",
    ],
    cta: { label: "Discuss your requirement", href: "contact.html?service=Private+Funds" },
  },
  {
    id: "project-funding",
    title: "Project Funding",
    tag: "Project finance",
    icon: "trending-up",
    tone: "bronze",
    image: "assets/images/architecture-pool.jpg",
    alt: "Property and construction project with a pool",
    description:
      "Support for project funding enquiries, focused on understanding the project, documentation and funding pathway.",
    details: [
      "Project-related funding discussions and preparation",
      "Guidance on business and project documentation",
      "Help presenting the requirement clearly",
      "Assessment and funding terms depend on the provider or lender",
    ],
    cta: { label: "Discuss project funding", href: "contact.html?service=Project+Funding" },
  },
  {
    id: "insurance",
    title: "Insurance",
    tag: "Protection planning",
    icon: "shield-check",
    tone: "teal",
    image: "assets/images/service-insurance.jpg",
    alt: "An advisor explaining an insurance policy to a client",
    description:
      "Assistance with insurance-related enquiries, helping you understand options and the information needed to proceed.",
    details: [
      "General insurance enquiry support",
      "Help understanding cover options and documentation",
      "Guidance on questions to ask before choosing a policy",
      "Policy terms, eligibility and claims are governed by the insurer",
    ],
    cta: { label: "Ask about insurance", href: "contact.html?service=Insurance" },
  },
  {
    id: "instant-loans",
    title: "Instant Loans",
    tag: "Quick enquiry",
    icon: "zap",
    tone: "coral",
    image: "assets/images/service-instant.jpg",
    alt: "Person reviewing options on a smartphone",
    description:
      "Guidance for urgent personal funding enquiries, helping you understand eligibility, documentation and responsible next steps.",
    details: [
      "Discussion of urgent funding needs and timelines",
      "Overview of common eligibility and document requirements",
      "Clear explanation of charges and repayment obligations",
      "Approval, speed and terms depend on the lender or provider",
    ],
    cta: { label: "Enquire now", href: "contact.html?service=Instant+Loan" },
  },
  {
    id: "open-plot-purchase",
    title: "Open Plot Purchase",
    tag: "Property planning",
    icon: "map",
    tone: "olive",
    image: "assets/images/service-plot.jpg",
    alt: "Aerial view of plotted land ready for development",
    description:
      "Support for enquiries related to open plot purchase financing, with guidance on documentation and lender considerations.",
    details: [
      "Help understanding plot-purchase related financing enquiries",
      "Guidance on property, title and documentation checks to discuss",
      "Support preparing information for lender review where applicable",
      "Availability and eligibility depend on lender policy and property verification",
    ],
    cta: { label: "Discuss plot purchase", href: "contact.html?service=Open+Plot+Purchase" },
  },
  {
    id: "new-car-loans",
    title: "New Car Loans",
    tag: "Vehicle finance",
    icon: "car",
    tone: "blue",
    image: "assets/images/service-new-car.jpg",
    alt: "A new car at a dealership showroom",
    description:
      "Assistance for new car loan enquiries, including help comparing options, documents and repayment considerations.",
    details: [
      "Guidance for new vehicle financing enquiries",
      "Help understanding down payment, tenure and charges",
      "Support with common application documentation",
      "Rates, approval and terms are decided by the lender",
    ],
    cta: { label: "Enquire about a new car loan", href: "contact.html?service=New+Car+Loan" },
  },
  {
    id: "used-car-loans",
    title: "Used Car Loans",
    tag: "Pre-owned vehicle",
    icon: "car-front",
    tone: "steel",
    image: "assets/images/service-used-car.jpg",
    alt: "Pre-owned cars displayed at a dealership",
    description:
      "Guidance for used car loan enquiries, helping you review vehicle-related requirements and lender documentation.",
    details: [
      "Support for pre-owned vehicle financing enquiries",
      "Discussion of vehicle age, valuation and lender criteria",
      "Help preparing application and ownership documents",
      "Eligibility and final terms depend on lender assessment",
    ],
    cta: { label: "Enquire about a used car loan", href: "contact.html?service=Used+Car+Loan" },
  },
  {
    id: "doctors-loans",
    title: "Doctors Loans",
    tag: "Professional finance",
    icon: "stethoscope",
    tone: "rose",
    image: "assets/images/service-doctors.jpg",
    alt: "A doctor in a clinical setting",
    description:
      "Guidance for doctors and medical professionals exploring loan options, with support on documentation and lender pathways.",
    details: [
      "Enquiry support for professional financing needs",
      "Help understanding income and practice-related documents",
      "Discussion of suitable options based on lender criteria",
      "Product availability and approval depend on the lender",
    ],
    cta: { label: "Enquire as a doctor", href: "contact.html?service=Doctors+Loan" },
  },
];

export const processSteps = [
  {
    number: "01",
    icon: "search",
    title: "Find Your Loan",
    text: "Share your requirement and we shortlist suitable lenders and structures.",
    tone: "powder",
  },
  {
    number: "02",
    icon: "upload",
    title: "Submit Your Documents",
    text: "We give you a clear checklist and help you assemble a complete file.",
    tone: "lavender",
  },
  {
    number: "03",
    icon: "chart-no-axes-column-increasing",
    title: "Profile Assessment",
    text: "Eligibility, income and property details are reviewed with the lender.",
    tone: "peach",
  },
  {
    number: "04",
    icon: "badge-check",
    title: "Lender Decision",
    text: "The lender issues its decision and sanction terms, subject to policy.",
    tone: "sage",
  },
];

export const loanBenefits = [
  {
    icon: "percent",
    title: "Compare the full cost",
    text: "Look past the headline rate to understand fees, tenure and total interest.",
  },
  {
    icon: "hand-coins",
    title: "Plan your down payment",
    text: "Understand how loan-to-value and your contribution affect affordability.",
  },
  {
    icon: "shield-check",
    title: "Prepare a stronger file",
    text: "Clear documentation and realistic eligibility expectations save time.",
  },
  {
    icon: "route",
    title: "One guided journey",
    text: "A single point of contact from first comparison to lender decision.",
  },
];

export const eligibilityGuidance = [
  {
    label: "Applicant age",
    value: "Typically 21–65 years",
    note: "Varies by lender and co-applicant profile.",
  },
  {
    label: "Salaried income",
    value: "Stable monthly income with proof",
    note: "Lenders assess net income, obligations and employment stability.",
  },
  {
    label: "Self-employed income",
    value: "ITR and business financials",
    note: "Usually 2–3 years of documentation, subject to lender policy.",
  },
  {
    label: "Credit profile",
    value: "Healthy repayment history",
    note: "A higher credit score may improve the options available.",
  },
  {
    label: "Property",
    value: "Clear title and lender approval",
    note: "Legal and technical verification is completed by the lender.",
  },
  {
    label: "Contribution",
    value: "Margin money as per lender",
    note: "Loan-to-value limits depend on loan amount and property value.",
  },
];

export const documentsChecklist = [
  "PAN and Aadhaar (identity and address proof)",
  "Latest salary slips and bank statements, or ITR and business financials",
  "Employment or business proof",
  "Property documents, chain of title and approved plan",
  "Existing loan statements, where applicable",
  "Photographs and signed application forms",
];

export const faqs = [
  {
    q: "How much home loan can I get?",
    a: "Eligibility depends on your income, existing obligations, credit profile, age, property value and the lender's loan-to-value policy. A lender makes the final assessment after reviewing your file.",
  },
  {
    q: "Is the interest rate fixed or floating?",
    a: "Both structures exist. Floating rates move with the lender's benchmark; fixed or part-fixed options may be available for a limited period. Review the terms carefully before choosing.",
  },
  {
    q: "Can I transfer my existing home loan?",
    a: "A balance transfer may be possible if another lender offers terms that better suit you. The benefit depends on the rate, remaining tenure, transfer charges and your eligibility.",
  },
  {
    q: "What does the 48-hour timeline mean?",
    a: "It is an indicative service timeline for an application journey, not a guarantee. Actual processing and sanction depend on lender policy, verification, eligibility and complete documentation.",
  },
  {
    q: "How are interest rates shown on this website determined?",
    a: "The rates displayed are clearly labelled samples for demonstration. They are not live offers. Always confirm current rates, fees and eligibility directly with the lender.",
  },
];

/**
 * Verified customer reviews only.
 * Add entries in this shape once reviews are confirmed and cleared for use:
 * { quote, name, city, rating, date, source: "Google", sourceUrl }
 * The carousel automatically uses these instead of the placeholder slides.
 */
export const verifiedReviews = [];

export const testimonialPlaceholders = [
  {
    category: "Home loan journey",
    quote:
      "A verified Google review from a home loan client will appear in this space once it has been collected and cleared for publication.",
    meta: "Review slot 01 · Awaiting verification",
  },
  {
    category: "Balance transfer",
    quote:
      "This carousel is ready for a verified review about refinancing an existing home loan. We do not publish unverified or edited testimonials.",
    meta: "Review slot 02 · Awaiting verification",
  },
  {
    category: "Documentation support",
    quote:
      "A verified review about documentation and application support will appear here. The source link will point to our Google Business Profile.",
    meta: "Review slot 03 · Awaiting verification",
  },
];

export const contactConfig = {
  loanTypes: [
    "Personal Loan",
    "Home Loan",
    "Business Loan",
    "Education Loan",
    "Mortgage Loan / Loan Against Property",
    "Private Funds",
    "Project Funding",
    "Insurance",
    "Instant Loan",
    "Open Plot Purchase",
    "New Car Loan",
    "Used Car Loan",
    "Doctors Loan",
    "Other",
  ],
  // No backend is connected in this phase. Set an endpoint later when the
  // enquiry API / Supabase integration is ready.
  formEndpoint: null,
  formNote:
    "This form validates your details in the browser only. Nothing is sent to a database or email inbox in this phase.",
};

export const footerServices = [
  { label: "Personal Loans", href: "contact.html?service=Personal+Loan" },
  { label: "Home Loans", href: "home-loans.html" },
  { label: "Business Loans", href: "contact.html?service=Business+Loan" },
  { label: "Education Loans", href: "contact.html?service=Education+Loan" },
  { label: "Mortgage Loans", href: "contact.html?service=Mortgage+Loan" },
  { label: "Insurance", href: "contact.html?service=Insurance" },
];

export const legalLinks = [
  { label: "Privacy Policy", href: "privacy.html" },
  { label: "Terms and Conditions", href: "terms.html" },
  { label: "Financial Disclaimer", href: "terms.html#financial-disclaimer" },
];

export const financialDisclaimer =
  "AS Financial Services and Solutions is a loan advisory service. We are not a bank, NBFC or lender and do not guarantee loan approval, interest rates, fees or processing timelines. All loan applications are assessed solely by the lender and are subject to its policies, eligibility criteria and documentation requirements. Rates and charges shown on this website are indicative samples and may change without notice. Please read all loan documents carefully before signing.";
