import React from "react";
import { Link } from "react-router-dom";
import { POLICY_CONTACT_EMAIL, policyBaseUrl, policyContactMailtoHref } from "@/policy/contact";
import { APP_NAME, DOCUMENT_TITLE_PRIVACY } from "@/policy/policyBranding";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";

const sectionClass = "mb-6";
const headingClass = "text-lg font-semibold text-slate-800 mt-8 mb-4 first:mt-0";
const paraClass = "text-slate-700 mb-4 leading-relaxed";
const listClass = "list-disc pl-6 mb-4 space-y-2 text-slate-700";

/** Public page — no login required. Scrolls inside #root (body overflow is hidden). */
export default function PrivacyPolicyPage() {
  const BASE_URL = policyBaseUrl();
  useDocumentTitle(DOCUMENT_TITLE_PRIVACY);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-slate-50 [-ms-overflow-style:auto] [scrollbar-width:auto]">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900">
            ← Back to app
          </Link>
          <span className="text-sm font-medium text-slate-700">{APP_NAME}</span>
        </div>
      </div>
      <div className="px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
          <header className="mb-8">
            <h1 className="mb-2 text-2xl font-bold text-slate-900 md:text-3xl">{DOCUMENT_TITLE_PRIVACY}</h1>
            <p className="text-sm text-slate-500">Last Updated: 16th Jul, 2026</p>
          </header>

          <section className={sectionClass}>
            <h2 className={headingClass}>Introduction</h2>
            <p className={paraClass}>
              Welcome to Synckerja Office ({BASE_URL}). We take your privacy seriously and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information, and how you can exercise your rights.
            </p>
            <p className={paraClass}>
              This policy applies to all users of our platform including website visitors, customers, and partners (you or users).
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Who We Are</h2>
            <p className={paraClass}>
              Synckerja Office is a global SaaS platform specializing in advanced messaging automation and conversational marketing. We empower businesses of all sizes to engage with their customers across popular messaging platforms such as WhatsApp, Facebook Messenger, Instagram, Telegram, and Website Live Chat—using intelligent chatbot workflows, AI capabilities, and integrated marketing tools.
            </p>
            <p className={paraClass}>
              Synckerja Office is operated by <strong>PT Integrasi Visual Digital Indonesia</strong>, a company based in <strong>Indonesia</strong>. For privacy-related requests, the data controller responsible for your personal information is PT Integrasi Visual Digital Indonesia, acting through the Synckerja Office service.
            </p>
            <p className={paraClass}>
              Our platform enables brands to generate leads, automate conversations, support sales, broadcast promotions, and build customer relationships—while complying with modern privacy and data protection standards.
            </p>
            <p className={paraClass}>
              We operate with a strong commitment to user privacy, data transparency, and responsible data management practices. Whether you are using Synckerja Office to run campaigns, train AI assistants, or build powerful automation flows, your privacy is one of our top priorities.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Information We Collect</h2>
            <p className={paraClass}>
              We collect various types of information to provide and improve our services, ensure security, comply with legal requirements, and offer a personalized user experience. The types of data we collect fall into the following categories:
            </p>
            <h3 className="mt-6 mb-3 text-base font-semibold text-slate-800">A. Information You Provide to Us Directly</h3>
            <p className={paraClass}>When you use Synckerja Office, you may provide us with personal information, including:</p>
            <ul className={listClass}>
              <li><strong>Account Registration Data:</strong> Name, email address, phone number, password, and language preference.</li>
              <li><strong>Profile Information:</strong> Business name, industry, company size, website URL, time zone, social profiles, and brand logo.</li>
              <li><strong>Billing & Payment Details:</strong> Billing name, address, credit/debit card details (handled securely by third-party processors), tax ID, and transaction history.</li>
              <li><strong>Customer Support Interactions:</strong> Any information you provide when you communicate with us via email, support tickets, or live chat (e.g., questions, feedback, screenshots, attachments).</li>
              <li><strong>Content You Generate:</strong> Message templates, chatbot flows, automation logic, AI training datasets, labels, tags, and subscriber notes created or uploaded by you on the platform.</li>
              <li><strong>Consent Preferences:</strong> Communication opt-in/opt-out preferences, cookie consent selections, and privacy settings.</li>
            </ul>
            <h3 className="mt-6 mb-3 text-base font-semibold text-slate-800">B. Information We Collect Automatically</h3>
            <p className={paraClass}>When you interact with Synckerja Office (e.g., visit the website, log in to your dashboard, or use any feature), we automatically collect:</p>
            <p className={paraClass}><strong>Device & Technical Data:</strong> IP address, browser type and version, operating system, device type and identifiers (e.g., User Agent, screen size), referral URLs.</p>
            <p className={paraClass}><strong>Usage Data:</strong> Pages visited, features accessed, time spent on pages or campaigns, error messages or performance metrics.</p>
            <p className={paraClass}><strong>Location Information:</strong> Approximate location derived from your IP address.</p>
            <p className={paraClass}><strong>Log Files:</strong> System logs generated when using our APIs or back-end systems, which may include timestamped metadata, request headers, and usage traces.</p>
            <h3 className="mt-6 mb-3 text-base font-semibold text-slate-800">C. Information from Third Parties and Integrations</h3>
            <p className={paraClass}>If you connect third-party services to Synckerja Office, we may collect information from those platforms, such as social platforms (e.g., Facebook Page ID, Instagram account data, YouTube channel ID and video performance metrics such as views, likes, and comments, TikTok account profile and video performance metrics, comments, and publish status, WhatsApp business number), e-commerce platforms (e.g., Shopify, WooCommerce), email and CRM tools, and authentication services.</p>
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
            <p className={paraClass}>If you are located in the European Economic Area (EEA), the United Kingdom, or Switzerland, we process your personal information in accordance with the GDPR and other applicable data protection laws. We process your data based on legal bases including performance of a contract, your consent, legitimate interests, legal obligations, and protection of vital interests. Additional GDPR-related commitments may be set out in applicable Data Processing Agreements where required.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Sharing Your Data</h2>
            <p className={paraClass}>We share data only when it is needed. We do not sell your personal information. We may share with: payment processors (e.g., Midtrans); email and CRM services; infrastructure and data-processing providers (including Supabase, Inc., as described below); WhatsApp, Facebook, Instagram, and Telegram platform APIs when you connect those channels; and government or law enforcement authorities only as described in the Government and Law Enforcement Requests section below.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Service Providers and Data Processors</h2>
            <p className={paraClass}>
              We use trusted third-party service providers to host, store, and process data on our behalf. These providers act as data processors and may only use your information to deliver services to Synckerja Office under our instructions and contractual safeguards.
            </p>
            <p className={paraClass}>
              Our primary infrastructure and data-processing provider is <strong>Supabase, Inc.</strong>, which hosts our database, authentication, file storage, and serverless backend functions. Platform data received from connected channels (including Meta/Facebook and Instagram messages, comments, tokens, and related metadata) is stored and processed through Supabase on our behalf in <strong>India</strong> (South Asia region).
            </p>
            <p className={paraClass}>
              We evaluate our service providers for appropriate security and privacy practices. We do not authorize processors to sell your personal information or use it for their own advertising purposes.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Government and Law Enforcement Requests</h2>
            <p className={paraClass}>
              We may disclose information when we believe disclosure is required by applicable law, regulation, legal process, or a valid governmental request. When we receive such requests, our practices include:
            </p>
            <ul className={listClass}>
              <li><strong>Legal review:</strong> We review each request to assess its validity and scope under applicable law before disclosing data.</li>
              <li><strong>Challenge unlawful requests:</strong> Where permitted by law, we may challenge, narrow, or refuse requests that we believe are unlawful, overbroad, or improperly issued.</li>
              <li><strong>Data minimization:</strong> We disclose only the minimum information reasonably necessary to comply with a valid request.</li>
              <li><strong>Documentation:</strong> We maintain internal records of government and law-enforcement requests and our responses, subject to legal restrictions on disclosure.</li>
            </ul>
            <p className={paraClass}>
              We have not received national-security or government data-access requests relating to Synckerja Office user data in the past 12 months. If this changes, we will update this policy as appropriate and comply with applicable legal obligations regarding transparency.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>International Data Transfers</h2>
            <p className={paraClass}>Synckerja Office is operated from Indonesia. Your personal information may also be transferred to, stored, and processed in countries other than your own, including <strong>India</strong>, where our infrastructure provider (Supabase, Inc.) hosts and processes data on our behalf. We take appropriate safeguards (e.g., Standard Contractual Clauses, adequacy decisions, or your explicit consent where required) to ensure your data remains protected in accordance with this Privacy Policy and applicable laws.</p>
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
            <p className={paraClass}>Our application may integrate with Google APIs, including Google sign-in, Google Drive (when you choose to connect Drive for file preview), Google Ads (when an administrator connects an ad account), YouTube (when an administrator connects a YouTube channel for organic content performance reporting and, when authorized, video publishing), and Google Contacts / People API (when an administrator connects a Google account to sync Omnichannel CRM leads into Google Contacts). We confirm that any user data obtained through these APIs is used solely to provide or improve user-facing features within Synckerja Office for the organization that connected the service. We do not use this data to develop, improve, or train generalized AI or machine learning models. We do not sell Google or YouTube user data. You may disconnect these integrations in your organization settings, which stops our further use of stored OAuth tokens for that integration. Our use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Google Contacts / People API Disclosure</h2>
            <p className={paraClass}>
              When an organization administrator connects a Google account through OAuth in Omnichannel → Settings → Google Contacts, Synckerja Office may create and update contacts in that Google account using the Google People API. Contact fields synced from CRM leads may include name, phone number, email address, and a short note that identifies the Synckerja lead (such as ticket id or source). Sync runs only for leads that have at least a phone number, and only for the organization that authorized the connection.
            </p>
            <p className={paraClass}>
              We use Google Contacts data solely to provide automatic contact bookkeeping for the connected organization so customer phone numbers appear in Google Contacts and related apps (such as WhatsApp on the user’s device). We do not sell Google Contacts data, use it to build advertising profiles, or use it to develop, improve, or train generalized AI or machine learning models. OAuth tokens are stored encrypted on our servers. Organization administrators may disconnect Google Contacts at any time in settings, which stops further sync and deactivates stored tokens for that connection. Our use of Google People API data adheres to the Google API Services User Data Policy, including the Limited Use requirements.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>YouTube API Disclosure</h2>
            <p className={paraClass}>
              When an organization administrator connects a YouTube channel through Google OAuth in Digital Marketing → Social Media Performance → YouTube settings, Synckerja Office may access YouTube data only to provide user-facing features for that organization. Depending on the permissions granted, this may include channel identity, published video lists, video performance metrics (such as views, likes, and comments), channel analytics, comments on connected videos (read and reply when authorized), and the ability to upload videos to the connected channel.
            </p>
            <p className={paraClass}>
              Video publishing occurs only when a user explicitly chooses Schedule or Post Now on an approved Reel content plan. The video file is retrieved from the Google Drive link attached to that plan (the file must be shared so it is accessible via the link). We do not perform background or automatic uploads. We store publish identifiers and basic metadata (such as title, privacy level, and publish time) to show posting status inside Synckerja Office.
            </p>
            <p className={paraClass}>
              We use YouTube data solely to provide or improve these features within Synckerja Office for the organization that connected the channel. We do not sell YouTube user data, use it to build advertising profiles, or use it to develop, improve, or train generalized AI or machine learning models. OAuth tokens are stored encrypted on our servers. Organization administrators may disconnect YouTube at any time in settings, which deactivates stored tokens for that connection. Our use of YouTube APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Meta Platform Data Disclosure</h2>
            <p className={paraClass}>
              When an organization administrator connects a Facebook Page or Instagram Business account through Meta OAuth in Omnichannel or Digital Marketing settings, Synckerja Office may access Meta platform data only to provide user-facing features for that organization. Depending on the permissions granted, this may include Page or account identifiers, profile information, posts and media metadata, comments on connected content, direct messages, webhook events, and OAuth access tokens needed to maintain the connection.
            </p>
            <p className={paraClass}>
              We use Meta platform data to operate connected-channel features such as unified inbox and live chat (Facebook Messenger and Instagram Direct), comment management, lead-capture automations (including Lead Magnet campaigns that match keywords, send public replies, and deliver follow-up messages), and related engagement workflows initiated by the connected business. These features run only for Pages and accounts that the administrator has authorized. We do not perform background access outside the connected account scope.
            </p>
            <p className={paraClass}>
              We use Meta platform data solely to provide or improve these features within Synckerja Office for the organization that connected the Page or account. We do not sell Meta platform data, use it to build advertising profiles for unrelated purposes, or use it to develop, improve, or train generalized AI or machine learning models. OAuth tokens and related credentials are stored encrypted on our servers through our infrastructure providers. Organization administrators may disconnect Facebook or Instagram at any time in settings, which deactivates stored tokens for that connection. Our use of Meta platform data complies with applicable Meta Platform Terms and Developer Policies.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>TikTok API Disclosure</h2>
            <p className={paraClass}>
              When an organization administrator connects a TikTok account through OAuth in Digital Marketing → Social Media Performance → TikTok settings, Synckerja Office may access TikTok data only to provide user-facing features for that organization. Depending on the permissions granted, this may include basic profile information (such as username and display name), published video lists, video performance metrics, comments on connected videos, and the ability to publish videos to the connected account.
            </p>
            <p className={paraClass}>
              Video publishing occurs only when a user explicitly chooses Schedule or Post Now on an approved content plan. We do not perform background or automatic uploads. We store publish identifiers and basic metadata (such as title, privacy level, and publish time) to show posting status inside Synckerja Office. Comment management is limited to reading and responding to comments on videos associated with the connected account.
            </p>
            <p className={paraClass}>
              We use TikTok data solely to provide or improve these features within Synckerja Office for the organization that connected the account. We do not sell TikTok user data, use it to build advertising profiles, or use it to develop, improve, or train generalized AI or machine learning models. OAuth tokens are stored encrypted on our servers. Organization administrators may disconnect TikTok at any time in settings, which deactivates stored tokens for that connection. Our use of TikTok APIs complies with the TikTok Developer Terms of Service and applicable TikTok platform policies.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Changes to This Policy</h2>
            <p className={paraClass}>We may update this Policy from time to time. Major changes will be notified by email or site notification. Your continued use of Synckerja Office after changes constitutes acceptance.</p>
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
