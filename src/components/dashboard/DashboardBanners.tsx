import DashboardAlertsBanner from './DashboardAlertsBanner';
import LiveEventBanner from './LiveEventBanner';
import MFARecommendationBanner from './MFARecommendationBanner';
import InstallAppBanner from './InstallAppBanner';
import DashboardBulletinBoard from './DashboardBulletinBoard';

/**
 * Single banner slot for every dashboard.
 * Order = priority: critical alerts first, security next, install prompt last.
 */
const DashboardBanners = () => (
  <div className="space-y-2 empty:hidden [&>*:not(:first-child)]:mt-0">
    <LiveEventBanner />
    <DashboardAlertsBanner />
    <MFARecommendationBanner />
    <InstallAppBanner />
    <DashboardBulletinBoard />
  </div>
);

export default DashboardBanners;
