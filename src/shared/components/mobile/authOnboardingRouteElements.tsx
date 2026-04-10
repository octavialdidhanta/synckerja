import { ForgotPasswordPage, GoogleOAuthCallbackPage, LoginPage, ResetPasswordPage } from "@/0-auth";
import {
  CreateOrganizationPage,
  CreatePlanPage,
  EmployeeWelcomePage,
  TermsAndConditionsPage,
} from "@/0-onboarding/index.ts";
import { EmailVerifiedPage, RegisterPage, VerifyEmailPage } from "@/0-register/index.ts";
import {
  MobileForgotPasswordPage as AndroidMobileForgotPasswordPage,
  MobileGoogleOAuthCallbackPage as AndroidMobileGoogleOAuthCallbackPage,
  MobileLoginPage as AndroidMobileLoginPage,
  MobileResetPasswordPage as AndroidMobileResetPasswordPage,
} from "@/mobile/0-auth/index";
import {
  MobileCreateOrganizationPage as AndroidMobileCreateOrganizationPage,
  MobileCreatePlanPage as AndroidMobileCreatePlanPage,
  MobileEmployeeWelcomePage as AndroidMobileEmployeeWelcomePage,
  MobileTermsAndConditionsPage as AndroidMobileTermsAndConditionsPage,
} from "@/mobile/0-onboarding/index";
import {
  MobileEmailVerifiedPage as AndroidMobileEmailVerifiedPage,
  MobileRegisterPage as AndroidMobileRegisterPage,
  MobileVerifyEmailPage as AndroidMobileVerifyEmailPage,
} from "@/mobile/0-register/index";
import {
  MobileForgotPasswordPage as IosMobileForgotPasswordPage,
  MobileGoogleOAuthCallbackPage as IosMobileGoogleOAuthCallbackPage,
  MobileLoginPage as IosMobileLoginPage,
  MobileResetPasswordPage as IosMobileResetPasswordPage,
} from "@/ios-mobile/0-auth/index";
import {
  MobileCreateOrganizationPage as IosMobileCreateOrganizationPage,
  MobileCreatePlanPage as IosMobileCreatePlanPage,
  MobileEmployeeWelcomePage as IosMobileEmployeeWelcomePage,
  MobileTermsAndConditionsPage as IosMobileTermsAndConditionsPage,
} from "@/ios-mobile/0-onboarding/index";
import {
  MobileEmailVerifiedPage as IosMobileEmailVerifiedPage,
  MobileRegisterPage as IosMobileRegisterPage,
  MobileVerifyEmailPage as IosMobileVerifyEmailPage,
} from "@/ios-mobile/0-register/index";
import { useAuthSurface } from "@/shared/hooks/useAuthSurface";

export function LoginRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  if (isDesktop) return <LoginPage />;
  if (isIosNative) return <IosMobileLoginPage />;
  return <AndroidMobileLoginPage />;
}

export function GoogleOAuthCallbackRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  if (isDesktop) return <GoogleOAuthCallbackPage />;
  if (isIosNative) return <IosMobileGoogleOAuthCallbackPage />;
  return <AndroidMobileGoogleOAuthCallbackPage />;
}

export function ForgotPasswordRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  if (isDesktop) return <ForgotPasswordPage />;
  if (isIosNative) return <IosMobileForgotPasswordPage />;
  return <AndroidMobileForgotPasswordPage />;
}

export function ResetPasswordRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  if (isDesktop) return <ResetPasswordPage />;
  if (isIosNative) return <IosMobileResetPasswordPage />;
  return <AndroidMobileResetPasswordPage />;
}

export function RegisterRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  if (isDesktop) return <RegisterPage />;
  if (isIosNative) return <IosMobileRegisterPage />;
  return <AndroidMobileRegisterPage />;
}

export function VerifyEmailRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  if (isDesktop) return <VerifyEmailPage />;
  if (isIosNative) return <IosMobileVerifyEmailPage />;
  return <AndroidMobileVerifyEmailPage />;
}

export function EmailVerifiedRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  if (isDesktop) return <EmailVerifiedPage />;
  if (isIosNative) return <IosMobileEmailVerifiedPage />;
  return <AndroidMobileEmailVerifiedPage />;
}

export function TermsAndConditionsRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  if (isDesktop) return <TermsAndConditionsPage />;
  if (isIosNative) return <IosMobileTermsAndConditionsPage />;
  return <AndroidMobileTermsAndConditionsPage />;
}

export function CreateOrganizationRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  if (isDesktop) return <CreateOrganizationPage />;
  if (isIosNative) return <IosMobileCreateOrganizationPage />;
  return <AndroidMobileCreateOrganizationPage />;
}

export function CreatePlanRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  if (isDesktop) return <CreatePlanPage />;
  if (isIosNative) return <IosMobileCreatePlanPage />;
  return <AndroidMobileCreatePlanPage />;
}

export function EmployeeWelcomeRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  if (isDesktop) return <EmployeeWelcomePage />;
  if (isIosNative) return <IosMobileEmployeeWelcomePage />;
  return <AndroidMobileEmployeeWelcomePage />;
}
