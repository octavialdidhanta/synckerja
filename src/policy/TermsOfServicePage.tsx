import React from "react";
import { Link } from "react-router-dom";
import { POLICY_CONTACT_EMAIL, policyBaseUrl, policyContactMailtoHref } from "@/policy/contact";

const sectionClass = "mb-6";
const headingClass = "text-lg font-semibold text-slate-800 mt-8 mb-4 first:mt-0";
const subHeadingClass = "mt-6 mb-3 text-base font-semibold text-slate-800";
const paraClass = "text-slate-700 mb-4 leading-relaxed";
const listClass = "list-disc pl-6 mb-4 space-y-2 text-slate-700";

/**
 * Public Terms of Service at `/policy/terms` — content aligned with product reference (ProfitLoop → Synckerja).
 * Governing law: Indonesia (operator: PT Integrasi Visual Digital Indonesia), not the reference jurisdiction.
 */
export default function TermsOfServicePage() {
  const BASE_URL = policyBaseUrl();
  const pricingUrl = `${BASE_URL}/pricing`;

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
            <h1 className="mb-2 text-2xl font-bold text-slate-900 md:text-3xl">Terms of Service</h1>
            <p className="text-sm text-slate-500">Last Updated: 26th Nov, 2025</p>
          </header>

          <section className={sectionClass}>
            <h2 className={headingClass}>Introduction</h2>
            <p className={paraClass}>
              Welcome to Synckerja. Please read these Terms of Service (Terms) carefully before using our website and services.
              These Terms govern your access to and use of {BASE_URL} and all associated services (collectively, the Service or
              Synckerja).
            </p>
            <p className={paraClass}>
              By accessing or using Synckerja, you agree to be bound by these Terms and any Data Processing Agreements where
              applicable. If you do not agree to these Terms, you may not use the Service.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Who We Are</h2>
            <p className={paraClass}>
              Synckerja is a global SaaS platform specializing in advanced messaging automation and conversational marketing. We
              empower businesses of all sizes to engage with their customers across popular messaging platforms such as WhatsApp,
              Facebook Messenger, Instagram, Telegram, and Website Live Chat—using intelligent chatbot workflows, AI capabilities,
              and integrated marketing tools.
            </p>
            <p className={paraClass}>
              Our platform enables brands to generate leads, automate conversations, support sales, broadcast promotions, and build
              customer relationships—while complying with modern privacy and data protection standards.
            </p>
            <p className={paraClass}>
              We operate with a strong commitment to user privacy, data transparency, and responsible data management practices.
              Whether you are using Synckerja to run campaigns, train AI assistants, or build powerful automation flows, your
              privacy is one of our top priorities.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Account Registration</h2>
            <p className={paraClass}>You must create an account to access most Synckerja features. By registering, you agree to:</p>
            <ul className={listClass}>
              <li>Provide accurate, current, and complete information</li>
              <li>Keep your login credentials confidential</li>
              <li>Be responsible for all activity under your account</li>
            </ul>
            <p className={paraClass}>
              We reserve the right to suspend or terminate accounts at our discretion, including for violations of these Terms or
              suspected fraud.
            </p>
            <p className={paraClass}>
              You must be at least 18 years old or of legal age in your jurisdiction to use Synckerja.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Subscription, Billing &amp; Payments</h2>
            <p className={paraClass}>Synckerja offers both free and paid plans. By subscribing, you agree to:</p>
            <ul className={listClass}>
              <li>
                Pay all applicable fees as per the pricing page (
                <a href={pricingUrl} className="break-all text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                  {pricingUrl}
                </a>
                )
              </li>
              <li>Authorize us to charge your provided payment method</li>
              <li>Be subject to automatic renewal unless canceled in advance</li>
            </ul>
            <p className={paraClass}>
              See our refund policy for details. Refunds are granted only under specific conditions. By using our services, you
              acknowledge and agree to the terms in our refund policy. For refund requests, contact us at{" "}
              <a href={policyContactMailtoHref()} className="break-all text-blue-600 hover:underline">
                {POLICY_CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>AI Use and Responsibility</h2>
            <p className={paraClass}>
              Synckerja uses AI technologies including intent detection, natural language processing, and AI-powered message
              generation. By using our AI features, you agree:
            </p>
            <ul className={listClass}>
              <li>Not to rely on AI-generated responses as legal, financial, or medical advice</li>
              <li>That AI content may be inaccurate, outdated, or biased</li>
              <li>To train AI responsibly using only permitted, lawful, and non-sensitive data</li>
            </ul>
            <p className={paraClass}>
              We disclaim all liability related to AI-generated outputs. You are solely responsible for verifying critical
              information.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Acceptable Use Policy</h2>
            <p className={paraClass}>You agree not to:</p>
            <ul className={listClass}>
              <li>Violate any local, national, or international laws</li>
              <li>Abuse our automation or messaging features to spam or mislead</li>
              <li>Upload malware, interfere with platform stability, or scrape our data</li>
              <li>Impersonate any person or organization</li>
              <li>Use Synckerja to build or promote hate speech, violence, or discrimination</li>
            </ul>
            <p className={paraClass}>We reserve the right to suspend or ban users for violations.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Prohibited Illegal Businesses and Activities</h2>
            <p className={paraClass}>
              Synckerja strictly prohibits the use of our platform for any illegal business activities or to promote, facilitate, or
              operate businesses that are illegal in any jurisdiction. The following categories of businesses and activities are
              explicitly prohibited.
            </p>
            <h3 className={subHeadingClass}>Prohibited Business Categories</h3>
            <ul className={listClass}>
              <li>
                <strong>Drugs and Controlled Substances:</strong> Any business involving the sale, distribution, or promotion of
                illegal drugs, narcotics, controlled substances, or prescription medications without proper authorization
              </li>
              <li>
                <strong>Weapons and Arms:</strong> Businesses dealing with firearms, ammunition, explosives, or other weapons
                where such activities are illegal or require special licensing that you do not possess
              </li>
              <li>
                <strong>Gambling and Betting:</strong> Illegal gambling operations, unlicensed betting services, or gambling
                activities prohibited in your jurisdiction
              </li>
              <li>
                <strong>Adult Content and Pornography:</strong> Distribution of explicit adult content, pornography, or sexually
                explicit material, especially involving minors or non-consenting individuals
              </li>
              <li>
                <strong>Human Trafficking:</strong> Any activity related to human trafficking, forced labor, or modern slavery
              </li>
              <li>
                <strong>Money Laundering:</strong> Businesses or activities designed to launder money or conceal the origins of
                illegally obtained funds
              </li>
              <li>
                <strong>Counterfeit Goods:</strong> Sale or distribution of counterfeit products, fake documents, or fraudulent
                merchandise
              </li>
              <li>
                <strong>Pyramid Schemes and Ponzi Schemes:</strong> Multi-level marketing scams, pyramid schemes, or other
                fraudulent investment schemes
              </li>
              <li>
                <strong>Identity Theft and Fraud:</strong> Activities involving identity theft, credit card fraud, or other forms of
                financial fraud
              </li>
              <li>
                <strong>Illegal Financial Services:</strong> Unlicensed money transmission, unregulated cryptocurrency schemes, or
                other illegal financial services
              </li>
              <li>
                <strong>Stolen Goods:</strong> Sale or distribution of stolen property or goods obtained through illegal means
              </li>
              <li>Any other business or activity that is illegal under applicable local, national, or international laws</li>
            </ul>
            <h3 className={subHeadingClass}>Consequences of Violation</h3>
            <p className={paraClass}>
              If we discover or have reasonable grounds to believe that you are using Synckerja for any prohibited illegal business
              or activity:
            </p>
            <ul className={listClass}>
              <li>We will immediately suspend or terminate your account without prior notice</li>
              <li>We may report your activities to relevant law enforcement authorities</li>
              <li>We will cooperate fully with legal investigations and provide information as required by law</li>
              <li>You will forfeit any unused subscription fees, and no refunds will be provided</li>
              <li>You may be held legally liable for any damages or consequences arising from your illegal use of our platform</li>
            </ul>
            <h3 className={subHeadingClass}>Your Responsibility</h3>
            <p className={paraClass}>
              It is your sole responsibility to ensure that your use of Synckerja complies with all applicable laws and regulations
              in your jurisdiction and the jurisdictions where your business operates. You represent and warrant that your business
              activities are legal and that you have obtained all necessary licenses, permits, and authorizations required to conduct
              your business.
            </p>
            <p className={paraClass}>
              By using Synckerja, you acknowledge that you understand these prohibitions and agree not to use our platform for any
              illegal business purposes. If you are unsure whether your business activity is permitted, please contact us at{" "}
              <a href={policyContactMailtoHref()} className="break-all text-blue-600 hover:underline">
                {POLICY_CONTACT_EMAIL}
              </a>{" "}
              before using our services.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>User Content and Data Ownership</h2>
            <p className={paraClass}>
              You retain ownership of all content you upload or generate using Synckerja. However, by using our platform, you grant
              Synckerja a non-exclusive, worldwide license to store, display, and process such content as necessary to provide
              services.
            </p>
            <p className={paraClass}>
              You must ensure your content does not violate third-party rights, laws, or platform policies (e.g., WhatsApp, Meta).
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Data Protection and Privacy</h2>
            <p className={paraClass}>
              We take your privacy seriously and comply with applicable data protection regulations. For detailed information about
              our data protection practices, please refer to our{" "}
              <Link to="/policy/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Cookies and Tracking</h2>
            <p className={paraClass}>
              Synckerja uses cookies and tracking technologies to improve user experience, analyze site traffic, enable core
              functionality, and assist with marketing and advertising efforts. By using our site, you consent to the placement of
              these cookies on your device unless you disable them via your browser settings. You may also be presented with
              cookie consent controls depending on your location.
            </p>
            <p className={paraClass}>
              We do not store personal information in cookies unless explicitly authorized by the user. For full details, including
              how to manage or withdraw your consent, please review our{" "}
              <Link to="/policy/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </Link>{" "}
              (including cookie-related disclosures).
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Intellectual Property</h2>
            <p className={paraClass}>
              All intellectual property rights in the Synckerja platform, including but not limited to the website design,
              software code (front-end and back-end), source code, chatbot logic, AI models, APIs, visual interfaces, logos, trade
              names, service marks, and all content provided through the Service (collectively, the Proprietary Materials), are
              owned by PT Integrasi Visual Digital Indonesia, Synckerja, or its licensors and are protected by applicable copyright,
              trademark, trade secret, and other intellectual property laws worldwide.
            </p>
            <p className={paraClass}>You may not:</p>
            <ul className={listClass}>
              <li>
                Copy, reproduce, modify, reverse engineer, decompile, disassemble, or create derivative works based on any part of
                the Service
              </li>
              <li>Use our name, logos, or branding without prior written consent</li>
              <li>Sell, license, rent, or commercially exploit any part of the Service or content</li>
              <li>Attempt to gain unauthorized access to source code, backend systems, or private data</li>
            </ul>
            <p className={paraClass}>
              We grant you a non-exclusive, non-transferable, revocable license to use our platform and content strictly in
              accordance with these Terms, and solely for your internal business or personal use.
            </p>
            <p className={paraClass}>
              Any feedback, suggestions, or ideas submitted to Synckerja regarding improvements or innovations may be used by us
              without any obligation to compensate you. You hereby assign all rights, title, and interest in such submissions to
              PT Integrasi Visual Digital Indonesia to the extent permitted by law.
            </p>
            <p className={paraClass}>Violation of this section may result in account suspension, legal action, or both.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Third-Party Platforms</h2>
            <p className={paraClass}>
              Synckerja integrates with WhatsApp, Facebook, Instagram, Telegram, Shopify, WooCommerce, and others. You agree to abide
              by the terms and policies of these platforms. We are not responsible for disruptions or rule changes from third-party
              services. For detailed information, please refer to our{" "}
              <Link to="/policy/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Limitation of Liability</h2>
            <p className={paraClass}>To the maximum extent permitted by law, Synckerja is not liable for:</p>
            <ul className={listClass}>
              <li>Lost profits, revenues, or data</li>
              <li>Service interruptions or failures</li>
              <li>Third-party platform restrictions</li>
              <li>AI inaccuracies or misuse</li>
            </ul>
            <p className={paraClass}>
              Our total liability is limited to the amount you paid to us in the 3 months prior to the incident.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Affiliate Policy</h2>
            <p className={paraClass}>
              The Synckerja Affiliate Program enables you to stand out and provide a unique experience for your audience while
              earning recurring commission. For detailed information, request the current Affiliate Policy by contacting us at{" "}
              <a href={policyContactMailtoHref()} className="break-all text-blue-600 hover:underline">
                {POLICY_CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Reseller Policy</h2>
            <p className={paraClass}>
              A Synckerja reseller is a business or entrepreneur that uses the Synckerja white-label program to sell chatbot
              automation services under their own brand name and domain, without having to develop or maintain the software
              themselves. For detailed information, request the current Reseller Policy by contacting us at{" "}
              <a href={policyContactMailtoHref()} className="break-all text-blue-600 hover:underline">
                {POLICY_CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Community Guidelines</h2>
            <p className={paraClass}>
              Synckerja may provide community forums and discussion boards to facilitate knowledge sharing, support, and
              collaboration among users. When participating in our forums, you agree to follow these community guidelines.
            </p>
            <h3 className={subHeadingClass}>Respectful Communication</h3>
            <ul className={listClass}>
              <li>
                Be respectful and courteous to all community members, regardless of their experience level, background, or opinions
              </li>
              <li>Use appropriate language and avoid profanity, offensive remarks, or discriminatory comments</li>
              <li>Engage in constructive discussions and provide helpful, accurate information</li>
              <li>Do not harass, bully, threaten, or intimidate other users</li>
            </ul>
            <h3 className={subHeadingClass}>Content Standards</h3>
            <ul className={listClass}>
              <li>Post only relevant content that contributes to the discussion topic</li>
              <li>Do not post spam, advertisements, promotional content, or affiliate links without permission</li>
              <li>Avoid posting duplicate threads or content</li>
              <li>Do not share personal information of yourself or others (e.g., email addresses, phone numbers, addresses)</li>
              <li>Respect intellectual property rights and do not post copyrighted material without authorization</li>
            </ul>
            <h3 className={subHeadingClass}>Prohibited Content</h3>
            <p className={paraClass}>You may not post content that:</p>
            <ul className={listClass}>
              <li>Is illegal, fraudulent, or violates any applicable laws or regulations</li>
              <li>Contains malware, viruses, or malicious code</li>
              <li>Is defamatory, libelous, or violates privacy rights</li>
              <li>Promotes hate speech, violence, discrimination, or illegal activities</li>
              <li>Impersonates another person, organization, or entity</li>
              <li>Contains explicit, pornographic, or adult content</li>
              <li>Violates platform policies of third-party services (e.g., WhatsApp, Facebook, Instagram)</li>
            </ul>
            <h3 className={subHeadingClass}>Moderation and Enforcement</h3>
            <ul className={listClass}>
              <li>Synckerja reserves the right to moderate, edit, or remove any forum posts at our discretion</li>
              <li>We may issue warnings, temporarily suspend, or permanently ban users who violate these guidelines</li>
              <li>Repeated violations may result in permanent forum access revocation</li>
              <li>Decisions regarding moderation are final and not subject to appeal</li>
            </ul>
            <p className={paraClass}>
              If you encounter content that violates these guidelines, please report it to our moderation team immediately. Do not
              engage with or respond to inappropriate content.
            </p>
            <p className={paraClass}>
              You are solely responsible for all content you post in our forums. Synckerja is not liable for user-generated content,
              and you agree to indemnify us against any claims arising from your posts.
            </p>
            <p className={paraClass}>
              By participating in Synckerja forums, you acknowledge that you have read, understood, and agree to comply with these
              community guidelines. Failure to adhere to these guidelines may result in immediate removal of content and termination
              of your forum access.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Indemnification</h2>
            <p className={paraClass}>
              You agree to indemnify, defend, and hold harmless Synckerja, PT Integrasi Visual Digital Indonesia, its subsidiaries,
              affiliates, officers, directors, employees, contractors, agents, licensors, and service providers from and against
              any and all third-party claims, demands, liabilities, damages, losses, costs, and expenses (including reasonable legal
              fees and costs) arising out of or relating to:
            </p>
            <ul className={listClass}>
              <li>Your access to or use of the Service</li>
              <li>Your violation of these Terms or any applicable laws or regulations</li>
              <li>Your user content, data, or any materials submitted or transmitted through your account</li>
              <li>
                Any actual or alleged infringement, misappropriation, or violation of any intellectual property, privacy, or other
                rights by you or your chatbot flows
              </li>
              <li>Your negligence or misconduct</li>
            </ul>
            <p className={paraClass}>
              This obligation includes your responsibility to cooperate with us in the defense or settlement of any such claim.
              We reserve the right to assume the exclusive defense and control of any matter subject to indemnification, in which
              case you agree to assist and cooperate with us as reasonably requested.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Termination</h2>
            <p className={paraClass}>
              We may suspend or terminate your access to Synckerja at our sole discretion without prior notice. Upon termination:
            </p>
            <ul className={listClass}>
              <li>Your license to use our services ends immediately</li>
              <li>We may retain your data as required by law or delete it upon request</li>
              <li>You may not create a new account if your previous one was suspended</li>
            </ul>
            <p className={paraClass}>
              For account and data deletion steps, see our{" "}
              <Link to="/policy/account-deletion" className="text-blue-600 hover:underline">
                Account and data deletion
              </Link>{" "}
              page (
              <a
                href={`${BASE_URL}/policy/account-deletion`}
                className="break-all text-blue-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {`${BASE_URL}/policy/account-deletion`}
              </a>
              ).
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Dispute Resolution and Governing Law</h2>
            <p className={paraClass}>
              These Terms are governed by the laws of the Republic of Indonesia, without regard to conflict-of-law principles. Any
              dispute shall first be addressed through informal resolution by contacting us at{" "}
              <a href={policyContactMailtoHref()} className="break-all text-blue-600 hover:underline">
                {POLICY_CONTACT_EMAIL}
              </a>
              . If a dispute cannot be resolved informally within a reasonable period, the courts of the Republic of Indonesia shall
              have exclusive jurisdiction, subject to any mandatory rights you may have under the consumer protection laws of your
              country of residence.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Changes to the Terms</h2>
            <p className={paraClass}>
              We may update these Terms from time to time. Major changes will be notified by email or site notification. Your
              continued use of Synckerja after changes constitutes acceptance.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Contact Us</h2>
            <p className={paraClass}>
              For legal inquiries or questions about these Terms, contact us at{" "}
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
