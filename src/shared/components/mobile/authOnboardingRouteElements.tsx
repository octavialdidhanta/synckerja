import { lazy, Suspense, type ReactNode } from "react";
import { useAuthSurface } from "@/shared/hooks/useAuthSurface";

function AuthSurfaceSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] w-full items-center justify-center bg-background" aria-busy>
          <span className="sr-only">Loading</span>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const DesktopLoginPage = lazy(() => import("@/0-auth").then((m) => ({ default: m.LoginPage })));
const DesktopGoogleOAuthCallbackPage = lazy(() =>
  import("@/0-auth").then((m) => ({ default: m.GoogleOAuthCallbackPage })),
);
const DesktopForgotPasswordPage = lazy(() =>
  import("@/0-auth").then((m) => ({ default: m.ForgotPasswordPage })),
);
const DesktopResetPasswordPage = lazy(() =>
  import("@/0-auth").then((m) => ({ default: m.ResetPasswordPage })),
);

const DesktopRegisterPage = lazy(() => import("@/0-register").then((m) => ({ default: m.RegisterPage })));
const DesktopVerifyEmailPage = lazy(() =>
  import("@/0-register").then((m) => ({ default: m.VerifyEmailPage })),
);
const DesktopEmailVerifiedPage = lazy(() =>
  import("@/0-register").then((m) => ({ default: m.EmailVerifiedPage })),
);

const DesktopTermsAndConditionsPage = lazy(() =>
  import("@/0-onboarding").then((m) => ({ default: m.TermsAndConditionsPage })),
);
const DesktopCreateOrganizationPage = lazy(() =>
  import("@/0-onboarding").then((m) => ({ default: m.CreateOrganizationPage })),
);
const DesktopCreatePlanPage = lazy(() =>
  import("@/0-onboarding").then((m) => ({ default: m.CreatePlanPage })),
);
const DesktopEmployeeWelcomePage = lazy(() =>
  import("@/0-onboarding").then((m) => ({ default: m.EmployeeWelcomePage })),
);

const AndroidMobileLoginPage = lazy(() =>
  import("@/mobile/0-auth").then((m) => ({ default: m.MobileLoginPage })),
);
const AndroidMobileGoogleOAuthCallbackPage = lazy(() =>
  import("@/mobile/0-auth").then((m) => ({ default: m.MobileGoogleOAuthCallbackPage })),
);
const AndroidMobileForgotPasswordPage = lazy(() =>
  import("@/mobile/0-auth").then((m) => ({ default: m.MobileForgotPasswordPage })),
);
const AndroidMobileResetPasswordPage = lazy(() =>
  import("@/mobile/0-auth").then((m) => ({ default: m.MobileResetPasswordPage })),
);

const AndroidMobileRegisterPage = lazy(() =>
  import("@/mobile/0-register").then((m) => ({ default: m.MobileRegisterPage })),
);
const AndroidMobileVerifyEmailPage = lazy(() =>
  import("@/mobile/0-register").then((m) => ({ default: m.MobileVerifyEmailPage })),
);
const AndroidMobileEmailVerifiedPage = lazy(() =>
  import("@/mobile/0-register").then((m) => ({ default: m.MobileEmailVerifiedPage })),
);

const AndroidMobileCreateOrganizationPage = lazy(() =>
  import("@/mobile/0-onboarding").then((m) => ({ default: m.MobileCreateOrganizationPage })),
);
const AndroidMobileCreatePlanPage = lazy(() =>
  import("@/mobile/0-onboarding").then((m) => ({ default: m.MobileCreatePlanPage })),
);
const AndroidMobileEmployeeWelcomePage = lazy(() =>
  import("@/mobile/0-onboarding").then((m) => ({ default: m.MobileEmployeeWelcomePage })),
);
const AndroidMobileTermsAndConditionsPage = lazy(() =>
  import("@/mobile/0-onboarding").then((m) => ({ default: m.MobileTermsAndConditionsPage })),
);

const IosMobileLoginPage = lazy(() => import("@/ios-mobile/0-auth").then((m) => ({ default: m.MobileLoginPage })));
const IosMobileGoogleOAuthCallbackPage = lazy(() =>
  import("@/ios-mobile/0-auth").then((m) => ({ default: m.MobileGoogleOAuthCallbackPage })),
);
const IosMobileForgotPasswordPage = lazy(() =>
  import("@/ios-mobile/0-auth").then((m) => ({ default: m.MobileForgotPasswordPage })),
);
const IosMobileResetPasswordPage = lazy(() =>
  import("@/ios-mobile/0-auth").then((m) => ({ default: m.MobileResetPasswordPage })),
);

const IosMobileRegisterPage = lazy(() =>
  import("@/ios-mobile/0-register").then((m) => ({ default: m.MobileRegisterPage })),
);
const IosMobileVerifyEmailPage = lazy(() =>
  import("@/ios-mobile/0-register").then((m) => ({ default: m.MobileVerifyEmailPage })),
);
const IosMobileEmailVerifiedPage = lazy(() =>
  import("@/ios-mobile/0-register").then((m) => ({ default: m.MobileEmailVerifiedPage })),
);

const IosMobileCreateOrganizationPage = lazy(() =>
  import("@/ios-mobile/0-onboarding").then((m) => ({ default: m.MobileCreateOrganizationPage })),
);
const IosMobileCreatePlanPage = lazy(() =>
  import("@/ios-mobile/0-onboarding").then((m) => ({ default: m.MobileCreatePlanPage })),
);
const IosMobileEmployeeWelcomePage = lazy(() =>
  import("@/ios-mobile/0-onboarding").then((m) => ({ default: m.MobileEmployeeWelcomePage })),
);
const IosMobileTermsAndConditionsPage = lazy(() =>
  import("@/ios-mobile/0-onboarding").then((m) => ({ default: m.MobileTermsAndConditionsPage })),
);

export function LoginRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  return (
    <AuthSurfaceSuspense>
      {isDesktop ? <DesktopLoginPage /> : isIosNative ? <IosMobileLoginPage /> : <AndroidMobileLoginPage />}
    </AuthSurfaceSuspense>
  );
}

export function GoogleOAuthCallbackRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  return (
    <AuthSurfaceSuspense>
      {isDesktop ? (
        <DesktopGoogleOAuthCallbackPage />
      ) : isIosNative ? (
        <IosMobileGoogleOAuthCallbackPage />
      ) : (
        <AndroidMobileGoogleOAuthCallbackPage />
      )}
    </AuthSurfaceSuspense>
  );
}

export function ForgotPasswordRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  return (
    <AuthSurfaceSuspense>
      {isDesktop ? (
        <DesktopForgotPasswordPage />
      ) : isIosNative ? (
        <IosMobileForgotPasswordPage />
      ) : (
        <AndroidMobileForgotPasswordPage />
      )}
    </AuthSurfaceSuspense>
  );
}

export function ResetPasswordRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  return (
    <AuthSurfaceSuspense>
      {isDesktop ? (
        <DesktopResetPasswordPage />
      ) : isIosNative ? (
        <IosMobileResetPasswordPage />
      ) : (
        <AndroidMobileResetPasswordPage />
      )}
    </AuthSurfaceSuspense>
  );
}

export function RegisterRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  return (
    <AuthSurfaceSuspense>
      {isDesktop ? <DesktopRegisterPage /> : isIosNative ? <IosMobileRegisterPage /> : <AndroidMobileRegisterPage />}
    </AuthSurfaceSuspense>
  );
}

export function VerifyEmailRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  return (
    <AuthSurfaceSuspense>
      {isDesktop ? (
        <DesktopVerifyEmailPage />
      ) : isIosNative ? (
        <IosMobileVerifyEmailPage />
      ) : (
        <AndroidMobileVerifyEmailPage />
      )}
    </AuthSurfaceSuspense>
  );
}

export function EmailVerifiedRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  return (
    <AuthSurfaceSuspense>
      {isDesktop ? (
        <DesktopEmailVerifiedPage />
      ) : isIosNative ? (
        <IosMobileEmailVerifiedPage />
      ) : (
        <AndroidMobileEmailVerifiedPage />
      )}
    </AuthSurfaceSuspense>
  );
}

export function TermsAndConditionsRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  return (
    <AuthSurfaceSuspense>
      {isDesktop ? (
        <DesktopTermsAndConditionsPage />
      ) : isIosNative ? (
        <IosMobileTermsAndConditionsPage />
      ) : (
        <AndroidMobileTermsAndConditionsPage />
      )}
    </AuthSurfaceSuspense>
  );
}

export function CreateOrganizationRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  return (
    <AuthSurfaceSuspense>
      {isDesktop ? (
        <DesktopCreateOrganizationPage />
      ) : isIosNative ? (
        <IosMobileCreateOrganizationPage />
      ) : (
        <AndroidMobileCreateOrganizationPage />
      )}
    </AuthSurfaceSuspense>
  );
}

export function CreatePlanRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  return (
    <AuthSurfaceSuspense>
      {isDesktop ? (
        <DesktopCreatePlanPage />
      ) : isIosNative ? (
        <IosMobileCreatePlanPage />
      ) : (
        <AndroidMobileCreatePlanPage />
      )}
    </AuthSurfaceSuspense>
  );
}

export function EmployeeWelcomeRouteElement() {
  const { isDesktop, isIosNative } = useAuthSurface();
  return (
    <AuthSurfaceSuspense>
      {isDesktop ? (
        <DesktopEmployeeWelcomePage />
      ) : isIosNative ? (
        <IosMobileEmployeeWelcomePage />
      ) : (
        <AndroidMobileEmployeeWelcomePage />
      )}
    </AuthSurfaceSuspense>
  );
}
