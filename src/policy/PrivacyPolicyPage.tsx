import React from "react";
import { Link } from "react-router-dom";
import { POLICY_CONTACT_EMAIL, policyBaseUrl, policyContactMailtoHref } from "@/policy/contact";

const sectionClass = "mb-6";
const headingClass = "text-lg font-semibold text-slate-800 mt-8 mb-4 first:mt-0";
const paraClass = "text-slate-700 mb-4 leading-relaxed";
const listClass = "list-disc pl-6 mb-4 space-y-2 text-slate-700";

/** Public page — no login required. Scrolls inside #root (body overflow is hidden). */
export default function PrivacyPolicyPage() {
  const BASE_URL = policyBaseUrl();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-slate-50 [-ms-overflow-style:auto] [scrollbar-width:auto]">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900">
            ← Back to app
          </Link>
          <span className="text-sm font-medium text-slate-700">Synckerja</span>
        </div>
      </div>
      <div className="px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
          <header className="mb-8">
            <h1 className="mb-2 text-2xl font-bold text-slate-900 md:text-3xl">Privacy Policy</h1>
            <p className="text-sm text-slate-500">Last Updated: 26th Nov, 2025</p>
          </header>

          <section className={sectionClass}>
            <h2 className={headingClass}>Introduction</h2>
            <p className={paraClass}>
              Welcome to Synckerja ({BASE_URL}). We take your privacy seriously and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information, and how you can exercise your rights.
            </p>
            <p className={paraClass}>
              This policy applies to all users of our platform including website visitors, customers, and partners (you or users).
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Who We Are</h2>
            <p className={paraClass}>
              Synckerja is a global SaaS platform specializing in advanced messaging automation and conversational marketing. We empower businesses of all sizes to engage with their customers across popular messaging platforms such as WhatsApp, Facebook Messenger, Instagram, Telegram, and Website Live Chat—using intelligent chatbot workflows, AI capabilities, and integrated marketing tools.
            </p>
            <p className={paraClass}>
              Our platform enables brands to generate leads, automate conversations, support sales, broadcast promotions, and build customer relationships—while complying with modern privacy and data protection standards.
            </p>
            <p className={paraClass}>
              We operate with a strong commitment to user privacy, data transparency, and responsible data management practices. Whether you are using Synckerja to run campaigns, train AI assistants, or build powerful automation flows, your privacy is one of our top priorities.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Information We Collect</h2>
            <p className={paraClass}>
              We collect various types of information to provide and improve our services, ensure security, comply with legal requirements, and offer a personalized user experience. The types of data we collect fall into the following categories:
            </p>
            <h3 className="mt-6 mb-3 text-base font-semibold text-slate-800">A. Information You Provide to Us Directly</h3>
            <p className={paraClass}>When you use Synckerja, you may provide us with personal information, including:</p>
            <ul className={listClass}>
              <li><strong>Account Registration Data:</strong> Name, email address, phone number, password, and language preference.</li>
              <li><strong>Profile Information:</strong> Business name, industry, company size, website URL, time zone, social profiles, and brand logo.</li>
              <li><strong>Billing & Payment Details:</strong> Billing name, address, credit/debit card details (handled securely by third-party processors), tax ID, and transaction history.</li>
              <li><strong>Customer Support Interactions:</strong> Any information you provide when you communicate with us via email, support tickets, or live chat (e.g., questions, feedback, screenshots, attachments).</li>
              <li><strong>Content You Generate:</strong> Message templates, chatbot flows, automation logic, AI training datasets, labels, tags, and subscriber notes created or uploaded by you on the platform.</li>
              <li><strong>Consent Preferences:</strong> Communication opt-in/opt-out preferences, cookie consent selections, and privacy settings.</li>
            </ul>
            <h3 className="mt-6 mb-3 text-base font-semibold text-slate-800">B. Information We Collect Automatically</h3>
            <p className={paraClass}>When you interact with Synckerja (e.g., visit the website, log in to your dashboard, or use any feature), we automatically collect:</p>
            <p className={paraClass}><strong>Device & Technical Data:</strong> IP address, browser type and version, operating system, device type and identifiers (e.g., User Agent, screen size), referral URLs.</p>
            <p className={paraClass}><strong>Usage Data:</strong> Pages visited, features accessed, time spent on pages or campaigns, error messages or performance metrics.</p>
            <p className={paraClass}><strong>Location Information:</strong> Approximate location derived from your IP address.</p>
            <p className={paraClass}><strong>Log Files:</strong> System logs generated when using our APIs or back-end systems, which may include timestamped metadata, request headers, and usage traces.</p>
            <h3 className="mt-6 mb-3 text-base font-semibold text-slate-800">C. Information from Third Parties and Integrations</h3>
            <p className={paraClass}>If you connect third-party services to Synckerja, we may collect information from those platforms, such as social platforms (e.g., Facebook Page ID, Instagram account data, YouTube channel ID and video performance metrics such as views, likes, and comments, WhatsApp business number), e-commerce platforms (e.g., Shopify, WooCommerce), email and CRM tools, and authentication services.</p>
            <h3 className="mt-6 mb-3 text-base font-semibold text-slate-800">D. Cookies and Tracking Technologies</h3>
            <p className={paraClass}>We and our partners use cookies, pixels, and similar technologies to collect data about how users interact with our platform. Read more in our Cookie Policy.</p>
            <h3 className="mt-6 mb-3 text-base font-semibold text-slate-800">E. Aggregated and De-Identified Data</h3>
            <p className={paraClass}>We may generate aggregated, anonymized, or de-identified data by removing personally identifiable elements. This data is used for platform performance optimization, analytics, and reporting purposes and is not linked to any individual.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>How We Use Your Information</h2>
            <p className={paraClass}>We use the information we collect to provide, improve, and protect the services you use. We use it to: register and manage your account; authenticate access and ensure security; enable chatbot automations across supported channels; process payments; deliver customer support; personalize and improve your experience; communicate with you; perform analytics and performance monitoring; ensure platform security and prevent abuse; develop and train AI features (using anonymized data only, and we do not use Google Workspace API data or personally identifiable subscriber data to train generalized AI models); and comply with legal obligations.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Legal Bases for Processing (GDPR)</h2>
            <p className={paraClass}>If you are located in the European Economic Area (EEA), the United Kingdom, or Switzerland, we process your personal information in accordance with the GDPR and other applicable data protection laws. We process your data based on legal bases including performance of a contract, your consent, legitimate interests, legal obligations, and protection of vital interests. For detailed information about our GDPR compliance, please visit our GDPR Policy.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Sharing Your Data</h2>
            <p className={paraClass}>We share data only when it is needed. We do not sell your personal information. We may share with: payment processors (e.g., Stripe, Paddle); email and CRM services; cloud providers and analytics tools; WhatsApp, Facebook, Instagram, Telegram APIs; and law enforcement if legally required.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>International Data Transfers</h2>
            <p className={paraClass}>Synckerja may operate globally. Your personal information may be transferred to, stored, and processed in countries other than your own. We take appropriate safeguards (e.g., Standard Contractual Clauses, adequacy decisions, or your explicit consent where required) to ensure your data remains protected in accordance with this Privacy Policy and applicable laws.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Data Retention</h2>
            <p className={paraClass}>We retain your information as long as your account is active or as required to comply with legal, tax, and regulatory requirements. You can request deletion of your data at any time.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Your Rights</h2>
            <p className={paraClass}>Depending on your location, you may have the right to: access your personal data; correct inaccuracies; delete your data; withdraw consent; object to processing; request data portability; and limit processing of sensitive information.</p>
            <h3 className="mt-6 mb-3 text-base font-semibold text-slate-800">CCPA/CPRA Rights (California Residents)</h3>
            <p className={paraClass}>If you are a California resident, you have the right to know what we collect and how we use it, request deletion, opt-out of sale or sharing (we do not sell your data), correct inaccurate information, limit use of sensitive personal information, and not be discriminated against for exercising your rights. You may exercise these rights by emailing us or visiting {BASE_URL}/tickets.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Data Security</h2>
            <p className={paraClass}>We implement technical, administrative, and organizational safeguards to protect your data: encryption at rest and in transit (e.g., TLS 1.3, AES-256); secure access control; two-factor authentication for admin access; regular updates and patching; data redundancy and backups; employee access control and security training; vendor risk management; audit and monitoring; and incident detection and response. We do not store credit card numbers on our servers; payment processing is handled by PCI-DSS compliant providers. You are responsible for maintaining the security of your account credentials.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Third-Party Services</h2>
            <p className={paraClass}>Our platform integrates with third-party platforms including Facebook, Google, WhatsApp, Shopify, etc. These services are governed by their own privacy policies. We recommend reviewing those directly. We partner with providers that hold certifications such as ISO/IEC 27001, SOC 2 Type II, PCI-DSS, and comply with GDPR and CCPA/CPRA.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Data Deletion and Deactivation</h2>
            <p className={paraClass}>You can delete or deactivate your account and data via your account settings or by contacting us. Note: Backup retention may delay full deletion for up to 30 days.</p>
            <p className={paraClass}>
              For step-by-step account deletion instructions (including the URL required for app store listings), see our{" "}
              <Link to="/policy/account-deletion" className="text-blue-600 hover:underline">
                Account and data deletion
              </Link>{" "}
              page, or open{" "}
              <a href={`${BASE_URL}/policy/account-deletion`} className="break-all text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                {`${BASE_URL}/policy/account-deletion`}
              </a>
              .
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Google API Limited Use Disclosure</h2>
            <p className={paraClass}>Our application may integrate with Google APIs, including Google sign-in, Google Drive (when you choose to connect Drive for file preview), Google Ads (when an administrator connects an ad account), and YouTube (when an administrator connects a YouTube channel for organic content performance reporting). We confirm that any user data obtained through these APIs is used solely to provide or improve user-facing features within Synckerja for the organization that connected the service. We do not use this data to develop, improve, or train generalized AI or machine learning models. We do not sell Google or YouTube user data. You may disconnect these integrations in your organization settings, which stops our further use of stored OAuth tokens for that integration. Our use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Changes to This Policy</h2>
            <p className={paraClass}>We may update this Policy from time to time. Major changes will be notified by email or site notification. Your continued use of Synckerja after changes constitutes acceptance.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Contact Us</h2>
            <p className={paraClass}>
              For privacy-related concerns or to exercise your rights, contact us at{" "}
              <a href={policyContactMailtoHref()} className="break-all text-blue-600 hover:underline">
                {POLICY_CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
