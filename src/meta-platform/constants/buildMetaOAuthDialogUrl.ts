import { META_GRAPH_VERSION } from '@/meta-platform/constants/metaGraphVersion';

export type BuildMetaOAuthDialogUrlArgs = {
  appId: string;
  redirectUri: string;
  state: string;
  /** Business Login configuration ID — when set, scope must be omitted (Meta defines permissions from config). */
  configId?: string;
  /** Fallback when configId is empty. */
  scope?: string;
  /** Re-show asset picker on reconnect (Facebook Page flow). */
  authTypeRerequest?: boolean;
  graphVersion?: string;
};

/**
 * Build Facebook Login for Business dialog URL.
 * @see https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/
 * When config_id is present, do not pass scope — duplicate/conflicting scope causes invalid_scope on FBE step.
 */
export function buildMetaOAuthDialogUrl(args: BuildMetaOAuthDialogUrlArgs): string {
  const params = new URLSearchParams({
    client_id: args.appId.trim(),
    redirect_uri: args.redirectUri.trim(),
    state: args.state,
  });
  const configId = args.configId?.trim() ?? '';
  if (configId) {
    params.set('config_id', configId);
  } else {
    const scope = args.scope?.trim() ?? '';
    if (scope) params.set('scope', scope);
  }
  params.set('display', 'page');
  params.set('response_type', 'token');
  if (args.authTypeRerequest) params.set('auth_type', 'rerequest');
  const version = args.graphVersion?.trim() || META_GRAPH_VERSION;
  return `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`;
}
