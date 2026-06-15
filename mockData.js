// TAMEYO Monitor - Mock Data for local development
// Usage: append ?mock=pro or ?mock=lite or ?mock=agency to URL
// Additional params: &reports=1 (first visit), &status=paused, &status=cancelled

const MOCK_DATA = {
  pro: {
    masterRecord: {
      subscriber_id: "TM-2026-0047",
      plan: "pro",
      billing: "monthly",
      signup_date: "2025-11-17",
      website_url: "https://coastalhvac.com",
      business_name: "Coastal HVAC Co.",
      city: "Miami",
      target_keyword_1: "HVAC repair Miami",
      target_keyword_2: "AC repair Miami",
      target_keyword_3: "heating cooling Miami",
      trustpilot_url: "https://trustpilot.com/review/coastalhvac.com",
      email: "owner@coastalhvac.com",
      status: "active",
      run_day: 17
    },
    snapshots: [
      { subscriber_id:"TM-2026-0047", snapshot_date:"2025-11-17", report_number:1, maps_rank_kw1:14, maps_rank_kw2:null, maps_rank_kw3:null, gbp_completeness_pct:58, mobile_pagespeed:38, desktop_pagespeed:71, cwv_lcp_status:"Fail", cwv_inp_status:"Fail", cwv_cls_status:"Pass", google_review_count:112, google_star_rating:4.6, google_new_reviews:null, trustpilot_rating:4.4, domain_authority:24, backlinks_total:287, onpage_seo_score:72 },
      { subscriber_id:"TM-2026-0047", snapshot_date:"2025-12-17", report_number:2, maps_rank_kw1:11, maps_rank_kw2:9, maps_rank_kw3:null, gbp_completeness_pct:67, mobile_pagespeed:44, desktop_pagespeed:74, cwv_lcp_status:"Fail", cwv_inp_status:"Fail", cwv_cls_status:"Pass", google_review_count:119, google_star_rating:4.6, google_new_reviews:7, trustpilot_rating:4.4, domain_authority:26, backlinks_total:301, onpage_seo_score:74 },
      { subscriber_id:"TM-2026-0047", snapshot_date:"2026-01-17", report_number:3, maps_rank_kw1:9, maps_rank_kw2:8, maps_rank_kw3:12, gbp_completeness_pct:67, mobile_pagespeed:52, desktop_pagespeed:78, cwv_lcp_status:"Pass", cwv_inp_status:"Fail", cwv_cls_status:"Pass", google_review_count:126, google_star_rating:4.7, google_new_reviews:7, trustpilot_rating:4.5, domain_authority:27, backlinks_total:334, onpage_seo_score:76 },
      { subscriber_id:"TM-2026-0047", snapshot_date:"2026-02-17", report_number:4, maps_rank_kw1:8, maps_rank_kw2:7, maps_rank_kw3:10, gbp_completeness_pct:75, mobile_pagespeed:58, desktop_pagespeed:81, cwv_lcp_status:"Pass", cwv_inp_status:"Fail", cwv_cls_status:"Pass", google_review_count:133, google_star_rating:4.7, google_new_reviews:7, trustpilot_rating:4.5, domain_authority:29, backlinks_total:368, onpage_seo_score:78 },
      { subscriber_id:"TM-2026-0047", snapshot_date:"2026-03-17", report_number:5, maps_rank_kw1:9, maps_rank_kw2:8, maps_rank_kw3:11, gbp_completeness_pct:75, mobile_pagespeed:74, desktop_pagespeed:82, cwv_lcp_status:"Pass", cwv_inp_status:"Fail", cwv_cls_status:"Pass", google_review_count:139, google_star_rating:4.8, google_new_reviews:6, trustpilot_rating:4.6, domain_authority:30, backlinks_total:389, onpage_seo_score:79 },
      { subscriber_id:"TM-2026-0047", snapshot_date:"2026-04-17", report_number:6, maps_rank_kw1:7, maps_rank_kw2:6, maps_rank_kw3:9, gbp_completeness_pct:75, mobile_pagespeed:74, desktop_pagespeed:83, cwv_lcp_status:"Pass", cwv_inp_status:"Fail", cwv_cls_status:"Pass", google_review_count:139, google_star_rating:4.8, google_new_reviews:0, trustpilot_rating:4.6, domain_authority:30, backlinks_total:401, onpage_seo_score:79 },
      { subscriber_id:"TM-2026-0047", snapshot_date:"2026-05-17", report_number:7, maps_rank_kw1:6, maps_rank_kw2:5, maps_rank_kw3:7, gbp_completeness_pct:75, mobile_pagespeed:67, desktop_pagespeed:84, cwv_lcp_status:"Pass", cwv_inp_status:"Fail", cwv_cls_status:"Pass", google_review_count:147, google_star_rating:4.8, google_new_reviews:8, trustpilot_rating:4.6, domain_authority:31, backlinks_total:412, onpage_seo_score:81 }
    ]
  },
  lite: {
    masterRecord: {
      subscriber_id: "TM-2026-0091",
      plan: "lite",
      billing: "monthly",
      signup_date: "2026-03-01",
      website_url: "https://miamiplumbing.com",
      business_name: "Miami Plumbing Pro",
      city: "Miami",
      target_keyword_1: "plumber Miami",
      email: "joe@miamiplumbing.com",
      status: "active",
      run_day: 1
    },
    snapshots: [
      { subscriber_id:"TM-2026-0091", snapshot_date:"2026-03-01", report_number:1, maps_rank_kw1:22, mobile_pagespeed:41, google_review_count:34, google_star_rating:4.3, google_new_reviews:null },
      { subscriber_id:"TM-2026-0091", snapshot_date:"2026-04-01", report_number:2, maps_rank_kw1:18, mobile_pagespeed:45, google_review_count:38, google_star_rating:4.4, google_new_reviews:4 },
      { subscriber_id:"TM-2026-0091", snapshot_date:"2026-05-01", report_number:3, maps_rank_kw1:14, mobile_pagespeed:48, google_review_count:43, google_star_rating:4.4, google_new_reviews:5 }
    ]
  },
  agency: {
    masterRecord: {
      subscriber_id: "TM-2026-0012",
      plan: "agency",
      billing: "monthly",
      signup_date: "2025-08-01",
      website_url: "https://sunstateelectric.com",
      business_name: "Sunstate Electric",
      city: "Orlando",
      target_keyword_1: "electrician Orlando",
      target_keyword_2: "electrical repair Orlando",
      target_keyword_3: "licensed electrician Orlando",
      trustpilot_url: "https://trustpilot.com/review/sunstateelectric.com",
      instagram_handle: "sunstateelectric",
      facebook_page_url: "https://facebook.com/sunstateelectric",
      competitor_1_url: "https://orlandoelectricpro.com",
      competitor_2_url: "https://centralfloridaelectric.com",
      competitor_3_url: "https://brightsideelectric.com",
      email: "ops@sunstateelectric.com",
      status: "active",
      run_day: 1
    },
    snapshots: [
      { subscriber_id:"TM-2026-0012", snapshot_date:"2026-05-01", report_number:10, maps_rank_kw1:3, maps_rank_kw2:2, maps_rank_kw3:5, gbp_completeness_pct:92, mobile_pagespeed:79, desktop_pagespeed:91, cwv_lcp_status:"Pass", cwv_inp_status:"Pass", cwv_cls_status:"Pass", google_review_count:312, google_star_rating:4.9, google_new_reviews:14, trustpilot_rating:4.8, trustpilot_review_count:67, domain_authority:44, backlinks_total:1204, backlinks_new:23, backlinks_lost:4, organic_rank_kw1:7, organic_rank_kw2:9, organic_rank_kw3:12, onpage_seo_score:88, instagram_engagement_rate:3.2, instagram_shadowban_status:"None", facebook_page_score:84, ai_visibility_google:"Present", ai_visibility_chatgpt:"Not found", competitor_1_maps_rank:8, competitor_2_maps_rank:5, competitor_3_maps_rank:11 }
    ]
  }
};

// Helper to get mock params from URL
function getMockConfig() {
  const params = new URLSearchParams(window.location.search);
  const tier = params.get('mock');
  if (!tier || !MOCK_DATA[tier]) return null;
  
  const data = JSON.parse(JSON.stringify(MOCK_DATA[tier]));
  
  // Override status if specified
  const status = params.get('status');
  if (status) data.masterRecord.status = status;
  
  // Truncate to 1 report for first-visit testing
  const reports = params.get('reports');
  if (reports === '1') data.snapshots = [data.snapshots[0]];
  
  return data;
}
