import DashboardAlertsBanner from './DashboardAlertsBanner';
import MFARecommendationBanner from './MFARecommendationBanner';
import InstallAppBanner from './InstallAppBanner';

/**
 * Single banner slot for every dashboard.
 * Order = priority: critical alerts first, security next, install prompt last.
 */
const DashboardBanners = () => (
  <div className="space-y-2 empty:hidden [&>*:not(:first-child)]:mt-0">
    <DashboardAlertsBanner />
    <MFARecommendationBanner />
    <InstallAppBanner />
  </div>
);

export default DashboardBanners;
