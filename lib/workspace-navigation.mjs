// UI routing only; database permissions and portal RPCs remain authoritative.
const publicViews = new Set(['jobs', 'catalog', 'employers', 'companies', 'career', 'support', 'join']);
const candidateViews = new Set(['notifications', 'dashboard', 'saved', 'mine', 'workspace']);
const adminViews = new Set(['admin', 'admin-orgs', 'admin-publications', 'admin-reports', 'admin-billing', 'settings']);
const organizationViews = new Set(['org-work', 'org-candidates', 'org-jobs', 'org-interviews', 'notifications']);

/** @typedef {{signedIn:boolean, ready:boolean, admin?:boolean, client?:boolean, org?:{id:string,kind:string}|null, role?:string, capabilities?:string[], capabilitiesLoading?:boolean, businessOnboarding?:boolean, businessAccount?:boolean}} WorkspaceContext */

/** @param {string} view @param {WorkspaceContext} context */
export function workspaceViewAllowed(view, context) {
  if (publicViews.has(view)) return true;
  if (!context.signedIn || !context.ready) return false;
  if (view === 'account-profile') return true;
  if (context.admin) return adminViews.has(view);
  if (context.org) {
    if (organizationViews.has(view)) return true;
    if (context.capabilitiesLoading) return false;
    const can = capability => context.capabilities?.includes(capability) === true;
    switch (view) {
      case 'org-clients': return context.org.kind === 'agency' && can('jobs.manage');
      case 'org-partnerships': return can('jobs.manage');
      case 'org-team': return can('team.configure');
      case 'org-rewards': return context.org.kind === 'agency' || can('rewards.read');
      case 'org-company':
      case 'org-connections': return can('organization.manage');
      case 'org-billing': return can('organization.manage') || context.role === 'finance';
      case 'org-reports': return can('reports.read');
      default: return false;
    }
  }
  if (context.client) return view === 'client-portal';
  if (view === 'team') return context.businessOnboarding === true;
  if (context.businessAccount) return false;
  return candidateViews.has(view);
}

/** @param {string} view @param {WorkspaceContext} context */
export function resolveWorkspaceView(view, context) {
  if (publicViews.has(view)) return view;
  if (context.signedIn && !context.ready) return 'account-loading';
  if (!context.signedIn) return 'jobs';
  // Resolve legacy workspace links before rendering a component, not after an effect.
  if (context.admin && ['team', 'dashboard', 'mine', 'pipeline'].includes(view)) return 'admin';
  if (context.org && !context.admin) {
    if (view === 'team') return 'org-work';
    if (view === 'workspace') return 'account-profile';
    if (view === 'pipeline') return 'org-jobs';
    if (view.startsWith('org-') && context.capabilitiesLoading) return 'account-loading';
  }
  if (workspaceViewAllowed(view, context)) return view;
  return context.admin ? 'admin' : context.org ? 'org-work' : context.client ? 'account-profile' : context.businessAccount ? 'team' : 'dashboard';
}

/** @param {string} view @param {WorkspaceContext} context */
export function workspaceNavigationVisible(view, context) {
  // This marketing page belongs on the public site, not in personal navigation.
  return view !== 'employers' && context.signedIn && context.ready && workspaceViewAllowed(view, context);
}
