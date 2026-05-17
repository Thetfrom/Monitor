// Page: My Dashboard
// File: pages/MyDashboard.js
//
// SETUP:
// 1. Wix editor → Pages → Add Page → name it "My Dashboard"
// 2. Page settings → Permissions → Members only
// 3. Add → Embed → Embed a Site → set src to https://audits.tameyogroup.com/dashboard
// 4. Resize iframe to full width + full height (remove Wix header/footer on this page)
// 5. In Wix editor, click the iframe element and note its ID (default: #html1)
// 6. Open Velo Dev Mode toggle, paste this file into the page's code panel

import { currentMember } from 'wix-members-frontend';
import { getSubscriberByEmail } from 'backend/subscriberLookup.jsw';

$w.onReady(async function () {
  // Only run in browser, not during SSR
  if (typeof window === 'undefined') return;

  // Listen for the 'ready' signal from the Netlify dashboard app.
  // The app posts { type: 'ready' } on load to signal it is waiting for auth.
  $w('#html1').onMessage(async (event) => {
    if (!event.data || event.data.type !== 'ready') return;

    try {
      const member = await currentMember.getMember({ fieldsets: ['FULL'] });
      const email = member.loginEmail;

      // Look up subscriber record by email via the backend function.
      // This keeps the Make.com webhook URL server-side only.
      const subscriberData = await getSubscriberByEmail(email);

      if (!subscriberData) {
        // No Monitor account found for this member email
        $w('#html1').postMessage({ type: 'auth_error', reason: 'no_account' });
        return;
      }

      // Send auth payload — dashboard app will fetch its full data from Make.com
      $w('#html1').postMessage({
        type: 'auth',
        subscriberId: subscriberData.subscriber_id,
        plan: subscriberData.plan,
        status: subscriberData.status,
        businessName: subscriberData.business_name,
      });

    } catch (err) {
      // currentMember.getMember() throws when the session is invalid
      $w('#html1').postMessage({ type: 'auth_error', reason: 'session_expired' });
    }
  });
});
